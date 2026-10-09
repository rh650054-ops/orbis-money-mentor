-- CRM da VANT — 09/10/2026
-- 1) crm_ajustes: mensagens editáveis + metas do dia (só via RPC, RLS sem policies)
-- 2) crm_numeros_periodo: métricas filtradas por data
-- 3) desfecho "contato_errado" + crm_cartao_whatsapp para corrigir o número
-- 4) crm_afiliados liberado pro comercial sem os campos de dinheiro

-- ---------- 1. ajustes (mensagens e metas) ----------
create table if not exists public.crm_ajustes (
  chave text primary key,
  valor jsonb not null default '{}'::jsonb,
  por uuid,
  atualizado_em timestamptz not null default now()
);
alter table public.crm_ajustes enable row level security;
revoke all on public.crm_ajustes from anon, authenticated;

create or replace function public.crm_ajustes_ler()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb)
  from public.crm_ajustes
  where public.is_orbis_crm();
$$;

-- texto de uma atividade: chave = "esteira/etapa/indice" (ex.: trial/dia1/0)
create or replace function public.crm_mensagem_salvar(p_chave text, p_titulo text, p_texto text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare atual jsonb;
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;
  if p_chave !~ '^[a-z]+/[a-z0-9]+/[0-9]{1,2}$' then raise exception 'chave inválida'; end if;
  if p_titulo is null or length(trim(p_titulo)) = 0 then raise exception 'título vazio'; end if;
  if length(p_titulo) > 120 or length(coalesce(p_texto,'')) > 2000 then raise exception 'texto longo demais'; end if;
  insert into public.crm_ajustes(chave, valor, por) values ('mensagens', '{}'::jsonb, auth.uid())
  on conflict (chave) do nothing;
  select valor into atual from public.crm_ajustes where chave = 'mensagens';
  atual := atual || jsonb_build_object(p_chave, jsonb_build_object('t', trim(p_titulo), 'm', p_texto));
  update public.crm_ajustes set valor = atual, por = auth.uid(), atualizado_em = now() where chave = 'mensagens';
  return atual;
end $$;

-- volta ao texto padrão (apaga a edição)
create or replace function public.crm_mensagem_padrao(p_chave text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare atual jsonb;
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;
  update public.crm_ajustes set valor = valor - p_chave, por = auth.uid(), atualizado_em = now()
  where chave = 'mensagens' returning valor into atual;
  return coalesce(atual, '{}'::jsonb);
end $$;

-- metas do dia (contatos e vendas) — só o dono define
create or replace function public.crm_metas_salvar(p_contatos int, p_vendas int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_orbis_admin() then raise exception 'apenas admin'; end if;
  if p_contatos < 1 or p_contatos > 500 or p_vendas < 0 or p_vendas > 100 then raise exception 'meta fora do limite'; end if;
  v := jsonb_build_object('contatos', p_contatos, 'vendas', p_vendas);
  insert into public.crm_ajustes(chave, valor, por) values ('metas', v, auth.uid())
  on conflict (chave) do update set valor = excluded.valor, por = auth.uid(), atualizado_em = now();
  return v;
end $$;

-- ---------- 2. métricas por período ----------
-- safra = quem entrou no período (contas/abriram/venderam/assinaram);
-- atividade = o que aconteceu no período (vendas Hotmart, contatos, mensagens)
create or replace function public.crm_numeros_periodo(p_de date, p_ate date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare ini timestamptz; fim timestamptz;
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 400 then raise exception 'período inválido'; end if;
  ini := p_de::timestamp at time zone 'America/Sao_Paulo';
  fim := (p_ate + 1)::timestamp at time zone 'America/Sao_Paulo';
  return jsonb_build_object(
    'de', p_de, 'ate', p_ate,
    'leads',    (select count(*) from leads l where l.created_at >= ini and l.created_at < fim),
    'contas',   (select count(*) from profiles p where coalesce(p.is_demo,false)=false and p.created_at >= ini and p.created_at < fim),
    'abriram',  (select count(*) from profiles p where coalesce(p.is_demo,false)=false and p.created_at >= ini and p.created_at < fim
                   and p.user_id in (select user_id from public._crm_quem_abriu)),
    'venderam', (select count(distinct d.user_id) from daily_sales d join profiles p on p.user_id = d.user_id
                   where coalesce(p.is_demo,false)=false and p.created_at >= ini and p.created_at < fim),
    'assinaram',(select count(distinct s.user_id) from subscriptions s join profiles p on p.user_id = s.user_id
                   where coalesce(p.is_demo,false)=false and p.created_at >= ini and p.created_at < fim),
    'vendas_novas', (select count(*) from hotmart_eventos h where h.event_type = 'PURCHASE_APPROVED' and coalesce(h.eh_renovacao,false)=false and h.recebido_em >= ini and h.recebido_em < fim),
    'vendas_renov', (select count(*) from hotmart_eventos h where h.event_type = 'PURCHASE_APPROVED' and coalesce(h.eh_renovacao,false)=true and h.recebido_em >= ini and h.recebido_em < fim),
    'receita',  case when public.is_orbis_admin() then
                  (select coalesce(sum(h.valor),0) from hotmart_eventos h where h.event_type = 'PURCHASE_APPROVED' and h.recebido_em >= ini and h.recebido_em < fim)
                end,
    'contatos', (select count(distinct x.cartao_id) from (
                   select c.cartao_id from crm_conversas c where c.de = 'eu' and c.origem = 'crm' and c.criado_em >= ini and c.criado_em < fim
                   union all
                   select e.cartao_id from crm_estado e where e.fechado_em >= ini and e.fechado_em < fim) x),
    'msgs_enviadas', (select count(*) from crm_conversas c where c.de = 'eu' and c.origem = 'crm' and c.criado_em >= ini and c.criado_em < fim),
    'msgs_respostas',(select count(*) from crm_conversas c where c.de = 'ele' and c.criado_em >= ini and c.criado_em < fim),
    'respondeu', (select count(*) from crm_estado e where e.fechado in ('respondeu','ganhou') and e.fechado_em >= ini and e.fechado_em < fim),
    'desfechos', (select count(*) from crm_estado e where e.fechado_em >= ini and e.fechado_em < fim),
    'contato_errado', (select count(*) from crm_estado e where e.fechado = 'contato_errado'),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('d', d.dia, 'contatos', d.n) order by d.dia), '[]'::jsonb) from (
                  select (c.criado_em at time zone 'America/Sao_Paulo')::date dia, count(distinct c.cartao_id) n
                  from crm_conversas c where c.de = 'eu' and c.criado_em >= ini and c.criado_em < fim group by 1) d)
  );
end $$;

-- ---------- 3. contato errado ----------
alter table public.crm_estado drop constraint if exists crm_estado_fechado_check;
alter table public.crm_estado add constraint crm_estado_fechado_check
  check (fechado = any (array['ganhou','respondeu','aguarda','perdido','contato_errado']));

alter table public.crm_conversas drop constraint if exists crm_conversas_origem_check;
alter table public.crm_conversas add constraint crm_conversas_origem_check
  check (origem = any (array['crm','webhook','sistema']));

-- corrige o WhatsApp da pessoa (conta ou lead) e tira a ficha de "contato errado"
create or replace function public.crm_cartao_whatsapp(p_cartao bigint, p_whatsapp text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d text; c public.crm_cartoes; antigo text;
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;
  -- padrão do banco: 11 dígitos (DDD + celular), sem o 55
  d := regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g');
  if d like '0%' then d := substr(d, 2); end if;
  if length(d) = 13 and d like '55%' then d := substr(d, 3); end if;
  if length(d) = 10 then d := substr(d,1,2) || '9' || substr(d,3); end if;
  if length(d) <> 11 or not public.telefone_valido(d) then raise exception 'WhatsApp inválido. Use DDD + número de celular (11 dígitos).'; end if;
  select * into c from public.crm_cartoes where id = p_cartao;
  if c.id is null then raise exception 'cartão não existe'; end if;
  if c.user_id is not null then
    select phone into antigo from public.profiles where user_id = c.user_id;
    update public.profiles set phone = d, updated_at = now() where user_id = c.user_id;
  elsif c.lead_id is not null then
    select whatsapp into antigo from public.leads where id = c.lead_id;
    update public.leads set whatsapp = d where id = c.lead_id;
  else
    raise exception 'ficha sem conta nem lead';
  end if;
  insert into public.crm_estado (cartao_id, por) values (p_cartao, auth.uid()) on conflict (cartao_id) do nothing;
  update public.crm_estado set fechado = null, fechado_em = null, por = auth.uid(), atualizado_em = now()
   where cartao_id = p_cartao and fechado = 'contato_errado';
  insert into public.crm_conversas(cartao_id, de, texto, origem, por)
  values (p_cartao, 'eu', 'WhatsApp corrigido no CRM: ' || coalesce(antigo,'—') || ' → ' || d, 'sistema', auth.uid());
  update public.crm_cartoes set atualizado_em = now() where id = p_cartao;
  return jsonb_build_object('cartao', p_cartao, 'whatsapp', d, 'antigo', antigo);
end $$;

-- ---------- 4. afiliados: comercial vê sem dinheiro ----------
create or replace function public.crm_afiliados(p_mes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ini timestamptz; fim timestamptz; v_dom text; dono boolean;
begin
  if not public.is_orbis_crm() then raise exception 'apenas admin ou comercial'; end if;
  dono := public.is_orbis_admin();
  ini := coalesce(to_timestamp(p_mes || '-01', 'YYYY-MM-DD') at time zone 'America/Sao_Paulo',
                  date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
  fim := (ini at time zone 'America/Sao_Paulo' + interval '1 month') at time zone 'America/Sao_Paulo';
  v_dom := coalesce(public.parc_cfg('dominio')#>>'{}', 'https://app.orbis.inf.br');
  return coalesce((
    select jsonb_agg(x order by (x->>'ativos')::int desc, (x->>'cadastros_mes')::int desc) from (
    select jsonb_build_object(
      'code', p.code, 'nome', p.nome, 'tipo', p.tipo, 'status', p.status, 'nivel', p.nivel,
      'nivel_nome', (select nome from public.parc_niveis where slug = p.nivel), 'vp', p.vp_ativos,
      'pct_recorrente', p.pct_recorrente, 'pct_bonus', p.pct_bonus_primeira,
      'pix', case when dono then public.parc_pix_mascarado(p.pix_chave) end,
      'link', v_dom || '/r/' || p.slug, 'link_cupom', v_dom || '/?cupom=' || p.code,
      'painel', case when dono then v_dom || '/parceiro/?t=' || p.token end,
      'entrou_em', to_char(p.entrou_em at time zone 'America/Sao_Paulo','DD/MM/YYYY'),
      'leads_mes',       (select count(*) from public.parc_indicacoes i where i.code = upper(trim(p.code)) and coalesce(i.conta_em, i.cadastro_em) >= ini and coalesce(i.conta_em, i.cadastro_em) < fim),
      'cadastros_mes',   (select count(*) from public.parc_indicacoes i where i.code = upper(trim(p.code)) and i.user_id is not null and i.conta_em >= ini and i.conta_em < fim),
      'cadastros_total', (select count(*) from public.parc_indicacoes i where i.code = upper(trim(p.code)) and i.user_id is not null),
      'cliques_mes',     (select count(*) from public.parc_cliques c where c.code = upper(trim(p.code)) and c.criado_em >= ini and c.criado_em < fim),
      'assinaturas_mes', (select count(distinct i.user_id) from public.parc_indicacoes i where i.code = upper(trim(p.code))
                            and ((i.assinou_em >= ini and i.assinou_em < fim)
                              or exists (select 1 from public.parc_cobrancas x where x.code = p.code and x.user_id = i.user_id and x.tipo = 'nova' and x.status <> 'cancelada' and x.ocorreu_em >= ini and x.ocorreu_em < fim))),
      'assinaturas_total', (select count(*) from public.parc_indicacoes i where i.code = upper(trim(p.code)) and (i.assinou_em is not null or i.status in ('ativo','inadimplente','cancelado','expirado'))),
      'ativos',          (select count(*) from public.parc_indicacoes i where i.code = upper(trim(p.code)) and i.status = 'ativo'),
      'ativos_do_mes',   (select count(*) from public.parc_indicacoes i where i.code = upper(trim(p.code)) and i.status = 'ativo' and i.assinou_em >= ini and i.assinou_em < fim),
      'novos_mes',     (select count(*) from public.parc_cobrancas x where x.code = p.code and x.tipo = 'nova' and x.status <> 'cancelada' and x.ocorreu_em >= ini and x.ocorreu_em < fim),
      'renov_mes',     (select count(*) from public.parc_cobrancas x where x.code = p.code and x.tipo = 'renovacao' and x.status <> 'cancelada' and x.ocorreu_em >= ini and x.ocorreu_em < fim),
      'receita_mes',   case when dono then (select coalesce(sum(liquido),0) from public.parc_cobrancas x where x.code = p.code and x.tipo in ('nova','renovacao') and x.status <> 'cancelada' and x.ocorreu_em >= ini and x.ocorreu_em < fim) end,
      'receita_total', case when dono then (select coalesce(sum(liquido),0) from public.parc_cobrancas x where x.code = p.code and x.tipo in ('nova','renovacao') and x.status <> 'cancelada') end,
      'com_novos_mes', case when dono then (select coalesce(sum(comissao),0) from public.parc_cobrancas x where x.code = p.code and x.tipo = 'nova' and x.status <> 'cancelada' and x.ocorreu_em >= ini and x.ocorreu_em < fim) end,
      'com_renov_mes', case when dono then (select coalesce(sum(comissao),0) from public.parc_cobrancas x where x.code = p.code and x.tipo = 'renovacao' and x.status <> 'cancelada' and x.ocorreu_em >= ini and x.ocorreu_em < fim) end,
      'com_mes',       case when dono then (select coalesce(sum(comissao),0) from public.parc_cobrancas x where x.code = p.code and x.status in ('confirmada','paga') and x.ocorreu_em >= ini and x.ocorreu_em < fim) end,
      'com_pendente_mes', case when dono then (select coalesce(sum(comissao),0) from public.parc_cobrancas x where x.code = p.code and x.status = 'pendente' and x.ocorreu_em >= ini and x.ocorreu_em < fim) end,
      'com_cancelada_mes',case when dono then (select coalesce(sum(comissao),0) from public.parc_cobrancas x where x.code = p.code and x.status = 'cancelada' and x.ocorreu_em >= ini and x.ocorreu_em < fim) end,
      'com_paga_mes',  case when dono then (select coalesce(sum(valor),0) from public.parc_pagamentos g where g.code = p.code and g.status = 'pago' and g.pago_em >= ini and g.pago_em < fim) end,
      'com_acumulada', case when dono then (select coalesce(sum(comissao),0) from public.parc_cobrancas x where x.code = p.code and x.status in ('confirmada','paga')) end,
      'com_confirmada',case when dono then (select coalesce(sum(comissao),0) from public.parc_cobrancas x where x.code = p.code and x.status = 'confirmada') end,
      'com_paga',      case when dono then (select coalesce(sum(valor),0) from public.parc_pagamentos g where g.code = p.code and g.status = 'pago') end,
      'pagamentos',    case when dono then (select coalesce(jsonb_agg(jsonb_build_object('valor', g.valor, 'ref', g.referencia, 'em', to_char(g.pago_em at time zone 'America/Sao_Paulo','DD/MM/YYYY'), 'obs', g.obs, 'transacao', g.transacao) order by g.pago_em desc), '[]'::jsonb)
                        from public.parc_pagamentos g where g.code = p.code) else '[]'::jsonb end
    ) as x from public.parceiros p) z
  ), '[]'::jsonb);
end $$;

revoke all on function public.crm_ajustes_ler() from public;
revoke all on function public.crm_mensagem_salvar(text,text,text) from public;
revoke all on function public.crm_mensagem_padrao(text) from public;
revoke all on function public.crm_metas_salvar(int,int) from public;
revoke all on function public.crm_numeros_periodo(date,date) from public;
revoke all on function public.crm_cartao_whatsapp(bigint,text) from public;
grant execute on function public.crm_ajustes_ler() to authenticated;
grant execute on function public.crm_mensagem_salvar(text,text,text) to authenticated;
grant execute on function public.crm_mensagem_padrao(text) to authenticated;
grant execute on function public.crm_metas_salvar(int,int) to authenticated;
grant execute on function public.crm_numeros_periodo(date,date) to authenticated;
grant execute on function public.crm_cartao_whatsapp(bigint,text) to authenticated;

-- anon nunca chama RPC do CRM (os advisors apontaram o grant padrão)
revoke execute on function public.crm_ajustes_ler() from anon;
revoke execute on function public.crm_mensagem_salvar(text,text,text) from anon;
revoke execute on function public.crm_mensagem_padrao(text) from anon;
revoke execute on function public.crm_metas_salvar(int,int) from anon;
revoke execute on function public.crm_numeros_periodo(date,date) from anon;
revoke execute on function public.crm_cartao_whatsapp(bigint,text) from anon;
