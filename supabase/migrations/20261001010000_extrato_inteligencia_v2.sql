-- Raio-X do extrato v2 — inteligencia entre contas (01/10/2026)
--
-- O que muda:
--  * CHAVE da contraparte: o Itau corta os nomes ("BOURB", "BOURBON", "BOURBOM IPI"). A chave
--    junta as variacoes num lugar so, pra regra, consolidacao e recorrencia funcionarem.
--  * ENTRE CONTAS: dinheiro que so mudou de lugar (Itau -> PicPay, InfinitePay -> Itau,
--    cofrinho/aplicacao) e marcado movimento='entre_contas' e NAO entra em "saiu"/"entrou".
--    Pareia a saida de um banco com a entrada no outro (mesmo valor, ate 2 dias, mesmo nome).
--  * FATURA: pagamento de fatura de cartao vira categoria propria. Conta no total — a nao
--    ser que a fatura detalhada do cartao tambem tenha sido enviada (ai seria duplicado).
--  * CONSOLIDACAO: o mesmo lugar fica na mesma categoria em todos os meses.
--  * RECORRENCIA: mesma contraparte 3+ meses com valor parecido -> "todo mes" (assinatura).
--  * CONTAS DE VENDAS x PESSOAIS: conta que recebe muitas vendas pequenas = conta de vendas.
--  * PERGUNTAS: quando a Vant tem duvida (Pix frequente pra uma pessoa, lugar com categorias
--    diferentes, "isso e conta sua?"), ela pergunta em vez de chutar.
--  * LANCAMENTO MANUAL: o vendedor lanca um gasto que nao esta em nenhum extrato.
-- Seguranca: tabelas novas com RLS (so leitura do proprio dono); toda escrita passa por
-- funcoes que conferem auth.uid(). A analise completa so roda pelo backend (service_role)
-- ou pelo proprio usuario sobre os proprios dados (extrato_reanalisar).

-- =====================================================================================
-- 1) colunas e tabelas
-- =====================================================================================
alter table public.extrato_lancamentos
  add column if not exists chave text,
  add column if not exists movimento text not null default 'normal',
  add column if not exists par_id uuid,
  add column if not exists recorrente boolean not null default false,
  add column if not exists pessoa text,
  add column if not exists origem text not null default 'arquivo';

alter table public.extrato_lancamentos drop constraint if exists extrato_lancamentos_movimento_check;
alter table public.extrato_lancamentos add constraint extrato_lancamentos_movimento_check check (movimento in ('normal','entre_contas','fatura'));
alter table public.extrato_lancamentos drop constraint if exists extrato_lancamentos_origem_check;
alter table public.extrato_lancamentos add constraint extrato_lancamentos_origem_check check (origem in ('arquivo','manual','pluggy'));
alter table public.extrato_lancamentos drop constraint if exists extrato_lancamentos_pessoa_check;
alter table public.extrato_lancamentos add constraint extrato_lancamentos_pessoa_check check (pessoa is null or pessoa in ('pf','pj'));
alter table public.extrato_lancamentos drop constraint if exists extrato_lancamentos_confianca_check;
alter table public.extrato_lancamentos add constraint extrato_lancamentos_confianca_check check (confianca in ('regra','ia','usuario','baixa','padrao'));
create index if not exists extrato_lanc_user_chave on public.extrato_lancamentos (user_id, chave);
create index if not exists extrato_lanc_user_par on public.extrato_lancamentos (user_id, tipo, valor, data);

alter table public.extrato_arquivos
  add column if not exists titular text,
  add column if not exists documento text not null default 'extrato';
alter table public.extrato_arquivos drop constraint if exists extrato_arquivos_documento_check;
alter table public.extrato_arquivos add constraint extrato_arquivos_documento_check check (documento in ('extrato','cartao'));

-- Regras agora sao por CHAVE + TIPO (a coluna "comerciante" guarda a chave), com valor minimo
-- opcional ("so os Pix acima de R$ 300 pra Isis sao rancho").
alter table public.extrato_regras_usuario
  add column if not exists tipo text not null default 'saida',
  add column if not exists valor_min numeric(12,2);
alter table public.extrato_regras_usuario drop constraint if exists extrato_regras_usuario_pkey;
alter table public.extrato_regras_usuario add constraint extrato_regras_usuario_pkey primary key (user_id, comerciante, tipo);

-- Nomes do titular (pra reconhecer "conta minha em outro banco").
create table if not exists public.extrato_titulares (
  user_id uuid not null,
  nome text not null,                       -- normalizado (MAIUSCULAS, sem numero)
  origem text not null default 'extrato' check (origem in ('extrato','perfil','usuario')),
  confirmado boolean not null default false,
  criado_em timestamptz not null default now(),
  primary key (user_id, nome)
);

-- Uso de cada conta/banco: vendas (maquininha, conta do corre) ou pessoal.
create table if not exists public.extrato_contas (
  user_id uuid not null,
  banco text not null,
  uso text not null check (uso in ('vendas','pessoal')),
  auto boolean not null default true,       -- false = o usuario escolheu, a analise nao mexe
  atualizado_em timestamptz not null default now(),
  primary key (user_id, banco)
);

-- Perguntas que a Vant faz quando tem duvida.
create table if not exists public.extrato_perguntas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  motivo text not null,                     -- conta_sua | pessoa | inconsistente | recorrente | nao_sei | lancamento
  alvo text not null,                       -- chave ou id do lancamento (unico por motivo)
  chave text,
  lancamento_id uuid references public.extrato_lancamentos(id) on delete cascade,
  tipo text not null default 'saida',
  nome text,
  qtd int,
  total numeric(12,2),
  meses int,
  dados jsonb not null default '{}'::jsonb,
  opcoes jsonb not null default '[]'::jsonb,
  status text not null default 'aberta' check (status in ('aberta','respondida','ignorada')),
  resposta text,
  criado_em timestamptz not null default now(),
  respondida_em timestamptz,
  unique (user_id, motivo, alvo)
);
create index if not exists extrato_perg_user_status on public.extrato_perguntas (user_id, status);

alter table public.extrato_titulares enable row level security;
alter table public.extrato_contas enable row level security;
alter table public.extrato_perguntas enable row level security;
drop policy if exists extrato_tit_sel on public.extrato_titulares;
create policy extrato_tit_sel on public.extrato_titulares for select using (user_id = auth.uid());
drop policy if exists extrato_contas_sel on public.extrato_contas;
create policy extrato_contas_sel on public.extrato_contas for select using (user_id = auth.uid());
drop policy if exists extrato_perg_sel on public.extrato_perguntas;
create policy extrato_perg_sel on public.extrato_perguntas for select using (user_id = auth.uid());
-- (sem policy de escrita: so as funcoes abaixo escrevem nessas tabelas)

-- Categorias: fatura de cartao separada; mercado vira "Mercado / rancho".
insert into public.extrato_categorias (slug, rotulo, icone, esfera_padrao, tipo, ordem) values
  ('fatura_cartao', 'Fatura do cartão', '💳', 'pessoal', 'saida', 22)
on conflict (slug) do update set rotulo = excluded.rotulo, icone = excluded.icone, esfera_padrao = excluded.esfera_padrao, tipo = excluded.tipo, ordem = excluded.ordem;
update public.extrato_categorias set rotulo = 'Mercado / rancho' where slug = 'mercado';
update public.extrato_categorias set rotulo = 'Bares e lanches' where slug = 'restaurante';

-- =====================================================================================
-- 2) normalizacao de nomes
-- =====================================================================================
-- Palavras que nao dizem QUEM e a contraparte (tiramos antes de comparar nomes).
create or replace function public.extrato_tokens(p text) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(w order by i), '{}'::text[])
  from unnest(regexp_split_to_array(public.extrato_norm(p), '\s+')) with ordinality as u(w, i)
  where w <> '' and not (w = any (array[
    'PIX','ENVIADO','ENVIADA','RECEBIDO','RECEBIDA','TRANSF','TRANSFERENCIA','TRANSFERENCI','TED','DOC',
    'PAG','PAGTO','PGTO','PAGAMENTO','PAGAMENTOS','COMPRA','COMPRAS','DEBITO','DEB','CREDITO','CRED',
    'CARTAO','ELO','VISA','MASTER','MASTERCARD','QR','QRCODE','SISPAG','INT','LANCAMENTO','AUT','BOLETO',
    'RECEBIMENTO','ENVIO','REM','CP','DE','DA','DO','DOS','DAS','PARA','EM','E','A','O','LTDA','ME','EPP',
    'EIRELI','SA','S']))
$$;

-- Chave da contraparte: primeiras 5 letras do 1o nome (o Itau corta em ~5). Se o 1o nome e
-- curto ("DG EMBA") ou generico ("MERCADO PAGO", "POSTO SHELL"), junta o 2o nome.
-- NULL = descricao generica ("PIX ENVIADO") — nao da pra saber quem e.
create or replace function public.extrato_chave(p text) returns text
language plpgsql immutable set search_path = public as $$
declare t text[] := public.extrato_tokens(p);
begin
  if coalesce(array_length(t, 1), 0) = 0 then return null; end if;
  if array_length(t, 1) >= 2 and (length(t[1]) <= 3 or t[1] = any (array[
      'MERCADO','SUPERMERCADO','SUPER','POSTO','AUTO','CASA','LOJA','LOJAS','BAR','RESTAURANTE','PADARIA',
      'DROGARIA','FARMACIA','LANCHONETE','COMERCIAL','COMERCIO','DISTRIBUIDORA','BANCO','ATACADO','EMPORIO',
      'ACOUGUE','CENTRO','PIZZARIA','HOTEL','CLINICA','IGREJA'])) then
    return t[1] || ' ' || left(t[2], 5);
  end if;
  return left(t[1], 5);
end $$;

-- O nome e de um titular (conta do proprio usuario)? 1o nome bate (5 letras) e algum
-- sobrenome bate (3 letras), ou o nome veio so com o 1o nome (>= 5 letras).
create or replace function public.extrato_eh_titular(p_uid uuid, p_nome text) returns boolean
language plpgsql stable set search_path = public as $$
declare t text[] := public.extrato_tokens(p_nome); tt text[]; r record;
begin
  if coalesce(array_length(t, 1), 0) = 0 or length(t[1]) < 4 then return false; end if;
  for r in select nome from public.extrato_titulares where user_id = p_uid loop
    tt := public.extrato_tokens(r.nome);
    continue when coalesce(array_length(tt, 1), 0) = 0 or left(t[1], 5) <> left(tt[1], 5);
    if array_length(t, 1) = 1 then
      if length(t[1]) >= 5 then return true; end if;
      continue;
    end if;
    if array_length(tt, 1) = 1 then return true; end if;
    if exists (select 1 from unnest(t[2:]) x, unnest(tt[2:]) y
               where length(x) >= 3 and length(y) >= 3 and left(x, 3) = left(y, 3)) then
      return true;
    end if;
  end loop;
  return false;
end $$;

-- =====================================================================================
-- 3) a analise (roda depois de cada leitura, de cada resposta e de cada "mover")
-- =====================================================================================
create or replace function public.extrato_analisar_padroes(p_uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_inv text := '\m(APLICACAO|APLIC|RESGATE|COFRINHO|COFRINHOS|CAIXINHA|CAIXINHAS|CDB|RDB|POUPANCA|INVESTIMENTO|TESOURO)\M';
  v_fat text := '\m(FATURA|PICPAY CARD)\M|PAGAMENTO CARTAO|PAGTO CARTAO|PGTO CARTAO|CARTAO DE CREDITO';
  v_pares int := 0; v_padrao int := 0; v_rec int := 0; v_ec int := 0; v_perg int := 0;
begin
  if p_uid is null then return '{}'::jsonb; end if;

  -- 0) chave da contraparte (do comerciante; se for generico, tenta a descricao)
  update public.extrato_lancamentos l
     set chave = coalesce(public.extrato_chave(l.comerciante), public.extrato_chave(l.descricao_norm))
   where l.user_id = p_uid
     and l.chave is distinct from coalesce(public.extrato_chave(l.comerciante), public.extrato_chave(l.descricao_norm));

  -- 1) fatura de cartao
  update public.extrato_lancamentos set categoria = 'fatura_cartao', esfera = 'pessoal', movimento = 'fatura'
   where user_id = p_uid and tipo = 'saida' and confianca <> 'usuario' and movimento <> 'fatura'
     and (descricao_norm ~ v_fat or coalesce(comerciante, '') ~ v_fat);
  update public.extrato_lancamentos set movimento = 'fatura'
   where user_id = p_uid and categoria = 'fatura_cartao' and movimento <> 'fatura';
  update public.extrato_lancamentos set movimento = 'normal'
   where user_id = p_uid and movimento = 'fatura' and categoria <> 'fatura_cartao';

  -- 2) regras que o usuario ensinou (por chave e tipo; valor minimo opcional)
  update public.extrato_lancamentos l set categoria = r.categoria, esfera = r.esfera, confianca = 'usuario'
    from public.extrato_regras_usuario r
   where l.user_id = p_uid and r.user_id = p_uid and r.comerciante = l.chave and r.tipo = l.tipo
     and (r.valor_min is null or l.valor >= r.valor_min) and l.movimento <> 'fatura'
     and (l.categoria <> r.categoria or l.confianca <> 'usuario' or l.esfera <> r.esfera);

  -- 3) entre contas — zera e recalcula
  update public.extrato_lancamentos set movimento = 'normal', par_id = null
   where user_id = p_uid and (movimento = 'entre_contas' or par_id is not null);

  -- 3a) dinheiro que so mudou de lugar: cofrinho/aplicacao, categoria "entre minhas contas",
  --     ou contraparte com o nome do titular
  update public.extrato_lancamentos l set movimento = 'entre_contas', esfera = 'pessoal',
         categoria = case when l.confianca = 'usuario' then l.categoria
                          when l.tipo = 'saida' then 'transferencia_propria' else 'transferencia_recebida' end
   where l.user_id = p_uid and l.movimento = 'normal'
     and ( l.categoria = 'transferencia_propria'
        or (l.confianca <> 'usuario' and (l.descricao_norm ~ v_inv or coalesce(l.comerciante, '') ~ v_inv))
        or (l.confianca <> 'usuario' and public.extrato_eh_titular(p_uid, coalesce(nullif(l.comerciante, ''), l.descricao_norm))) );

  -- 3b) pareia: a mesma quantia sai de um banco e entra em outro em ate 2 dias.
  --     Precisa de pelo menos um lado reconhecido como "meu" (ou valor >= 100 com os dois
  --     lados genericos) — so valor+data casa venda de R$ 12 com Pix de R$ 12 pra outra pessoa.
  with s as (
    select id, banco, data, valor, movimento = 'entre_contas' as meu from public.extrato_lancamentos
     where user_id = p_uid and tipo = 'saida' and banco is not null and valor >= 20
       and (movimento = 'entre_contas' or (movimento = 'normal' and chave is null and confianca <> 'usuario'))),
  e as (
    select id, banco, data, valor, movimento = 'entre_contas' as meu from public.extrato_lancamentos
     where user_id = p_uid and tipo = 'entrada' and banco is not null
       and (movimento = 'entre_contas' or (movimento = 'normal' and chave is null and confianca <> 'usuario'))),
  c as (
    select s.id sid, e.id eid, e.data - s.data dd from s join e
      on e.valor = s.valor and e.banco <> s.banco and e.data between s.data and s.data + 2
     where s.meu or e.meu or s.valor >= 100),
  c1 as (select distinct on (sid) sid, eid, dd from c order by sid, dd, eid),
  c2 as (select distinct on (eid) sid, eid from c1 order by eid, dd, sid),
  us as (
    update public.extrato_lancamentos l set movimento = 'entre_contas', par_id = c2.eid, esfera = 'pessoal',
           categoria = case when l.confianca = 'usuario' then l.categoria else 'transferencia_propria' end
      from c2 where l.id = c2.sid returning 1),
  ue as (
    update public.extrato_lancamentos l set movimento = 'entre_contas', par_id = c2.sid, esfera = 'pessoal',
           categoria = case when l.confianca = 'usuario' then l.categoria else 'transferencia_recebida' end
      from c2 where l.id = c2.eid returning 1)
  select (select count(*) from us) + 0 * (select count(*) from ue) into v_pares;

  select count(*) into v_ec from public.extrato_lancamentos where user_id = p_uid and movimento = 'entre_contas';

  -- 4) consolidacao: o mesmo lugar na mesma categoria (a lanchonete que voce volta meses
  --    depois continua "Bares e lanches"). So mexe no que a IA chutou, nunca no que voce ensinou.
  with base as (
    select chave, categoria, count(*) n from public.extrato_lancamentos
     where user_id = p_uid and tipo = 'saida' and movimento = 'normal' and chave is not null
       and categoria not in ('nao_identificado', 'outros')
     group by 1, 2),
  tot as (select chave, sum(n) total from base group by 1),
  dom as (select distinct on (b.chave) b.chave, b.categoria, b.n, t.total
            from base b join tot t using (chave) order by b.chave, b.n desc, b.categoria),
  alvo as (
    select d.chave, d.categoria from dom d
     where d.total >= 2 and d.n::numeric / d.total >= 0.6
       and not exists (select 1 from public.extrato_regras_usuario r
                        where r.user_id = p_uid and r.comerciante = d.chave and r.tipo = 'saida'))
  update public.extrato_lancamentos l set categoria = a.categoria, esfera = c.esfera_padrao, confianca = 'padrao'
    from alvo a join public.extrato_categorias c on c.slug = a.categoria
   where l.user_id = p_uid and l.chave = a.chave and l.tipo = 'saida' and l.movimento = 'normal'
     and l.confianca in ('ia', 'baixa', 'padrao') and l.categoria <> a.categoria;
  get diagnostics v_padrao = row_count;

  -- 5) recorrencia: mesma contraparte em 3+ meses, ~1 vez por mes, valor parecido (variacao <= 25%)
  update public.extrato_lancamentos set recorrente = false where user_id = p_uid and recorrente;
  with r as (
    select chave from public.extrato_lancamentos
     where user_id = p_uid and tipo = 'saida' and movimento = 'normal' and chave is not null
     group by chave
    having count(distinct date_trunc('month', data)) >= 3
       and count(*) <= count(distinct date_trunc('month', data)) * 1.5
       and coalesce(stddev_pop(valor) / nullif(avg(valor), 0), 0) <= 0.25
       and avg(valor) >= 5)
  update public.extrato_lancamentos l set recorrente = true,
         categoria = case when l.confianca in ('ia','baixa','padrao')
                           and (l.categoria in ('nao_identificado','outros') or (l.pessoa = 'pj' and l.categoria = 'pix_pessoas'))
                          then 'assinaturas' else l.categoria end,
         confianca = case when l.confianca in ('ia','baixa','padrao')
                           and (l.categoria in ('nao_identificado','outros') or (l.pessoa = 'pj' and l.categoria = 'pix_pessoas'))
                          then 'padrao' else l.confianca end
    from r where l.user_id = p_uid and l.chave = r.chave and l.tipo = 'saida' and l.movimento = 'normal';
  get diagnostics v_rec = row_count;

  -- 6) contas de vendas x pessoais: muitas entradas pequenas por mes = conta de vendas
  insert into public.extrato_contas (user_id, banco, uso, auto)
  select p_uid, b.banco,
         case when coalesce(e.n, 0) >= 20 * greatest(e.meses, 1) and coalesce(e.med, 999) <= 80 then 'vendas' else 'pessoal' end,
         true
    from (select distinct banco from public.extrato_lancamentos where user_id = p_uid and banco is not null) b
    left join (
      select banco, count(*) n, count(distinct date_trunc('month', data)) meses,
             percentile_cont(0.5) within group (order by valor) med
        from public.extrato_lancamentos
       where user_id = p_uid and tipo = 'entrada' and movimento = 'normal' and banco is not null
       group by banco) e on e.banco = b.banco
  on conflict (user_id, banco) do update set uso = excluded.uso, atualizado_em = now()
   where public.extrato_contas.auto and public.extrato_contas.uso <> excluded.uso;

  update public.extrato_lancamentos l
     set esfera = case when c.uso = 'vendas' or l.categoria = 'cartao_recebido' then 'corre' else 'pessoal' end
    from public.extrato_contas c
   where l.user_id = p_uid and c.user_id = p_uid and c.banco = l.banco and l.tipo = 'entrada'
     and l.movimento = 'normal' and l.confianca <> 'usuario'
     and l.esfera <> (case when c.uso = 'vendas' or l.categoria = 'cartao_recebido' then 'corre' else 'pessoal' end);

  -- 7) perguntas (as respondidas/ignoradas nao voltam; as abertas sao atualizadas)
  with l as (
    select * from public.extrato_lancamentos where user_id = p_uid and tipo = 'saida'),
  semregra as (
    select l.* from l where l.chave is null or not exists (
      select 1 from public.extrato_regras_usuario r where r.user_id = p_uid and r.comerciante = l.chave and r.tipo = 'saida')),
  -- a) "isso e uma conta sua?" — a IA achou que era, mas o nome nao bate com o titular
  q_conta as (
    select 'conta_sua'::text motivo, chave alvo, chave, null::uuid lanc,
           (array_agg(comerciante order by valor desc))[1] nome, count(*)::int qtd, sum(valor) total,
           count(distinct date_trunc('month', data))::int meses, '{}'::jsonb dados,
           jsonb_build_array(
             jsonb_build_object('v', '__minha_conta', 'r', 'Sim, é conta minha'),
             jsonb_build_object('v', 'pix_pessoas', 'r', 'Não, é outra pessoa'),
             jsonb_build_object('v', 'mercadoria', 'r', 'Fornecedor / mercadoria')) opcoes
      from semregra
     where chave is not null and categoria = 'transferencia_propria' and confianca <> 'usuario'
       and not (descricao_norm ~ v_inv or coalesce(comerciante, '') ~ v_inv)
       and not public.extrato_eh_titular(p_uid, comerciante)
     group by chave having sum(valor) >= 100),
  -- b) Pix frequente pra mesma pessoa: rancho? fornecedor? (com opcao "so os acima de R$ X")
  pes as (
    select chave, (array_agg(comerciante order by valor desc))[1] nome, count(*)::int qtd, sum(valor) total,
           count(distinct date_trunc('month', data))::int meses, min(valor) mn, max(valor) mx, round(avg(valor), 2) media,
           greatest(100, round(percentile_cont(0.75) within group (order by valor)::numeric / 50) * 50) lim
      from semregra
     where chave is not null and movimento = 'normal' and categoria = 'pix_pessoas' and confianca <> 'usuario'
     group by chave having count(*) >= 4 and sum(valor) >= 300),
  q_pes as (
    select 'pessoa'::text, p.chave, p.chave, null::uuid, p.nome, p.qtd, p.total, p.meses,
           jsonb_build_object('min', p.mn, 'max', p.mx, 'media', p.media),
           jsonb_build_array(jsonb_build_object('v', 'mercado', 'r', 'Mercado / rancho da casa'))
           || case when p.mx >= p.lim and p.mn < p.lim
                   then jsonb_build_array(jsonb_build_object('v', 'mercado', 'r', 'Rancho só os acima de {min}', 'min', p.lim))
                   else '[]'::jsonb end
           || jsonb_build_array(
                jsonb_build_object('v', 'mercadoria', 'r', 'Fornecedor / mercadoria'),
                jsonb_build_object('v', 'contas_casa', 'r', 'Aluguel / conta da casa'),
                jsonb_build_object('v', 'pix_pessoas', 'r', 'Pix pra pessoa mesmo'),
                jsonb_build_object('v', '__minha_conta', 'r', 'É conta minha'))
      from pes p),
  -- c) mesmo lugar com categorias diferentes e sem maioria clara
  inc as (
    select chave, categoria, count(*) n, sum(valor) total from semregra
     where chave is not null and movimento = 'normal' and categoria not in ('nao_identificado', 'outros') and confianca <> 'usuario'
     group by 1, 2),
  q_inc as (
    select 'inconsistente'::text, i.chave, i.chave, null::uuid,
           (select (array_agg(x.comerciante order by x.valor desc))[1] from semregra x where x.chave = i.chave),
           sum(i.n)::int, sum(i.total),
           (select count(distinct date_trunc('month', x.data))::int from semregra x where x.chave = i.chave),
           jsonb_build_object('categorias', jsonb_agg(c.rotulo order by i.n desc)),
           jsonb_agg(jsonb_build_object('v', i.categoria, 'r', c.icone || ' ' || c.rotulo) order by i.n desc)
             || jsonb_build_array(jsonb_build_object('v', 'outros', 'r', 'Outra coisa'))
      from inc i join public.extrato_categorias c on c.slug = i.categoria
     group by i.chave having count(*) >= 2 and sum(i.n) >= 3),
  -- d) todo mes pra mesma pessoa, valor parecido: aluguel? mensalidade?
  q_rec as (
    select 'recorrente'::text, chave, chave, null::uuid, (array_agg(comerciante order by data desc))[1], count(*)::int, sum(valor),
           count(distinct date_trunc('month', data))::int, jsonb_build_object('media', round(avg(valor), 2)),
           jsonb_build_array(
             jsonb_build_object('v', 'contas_casa', 'r', 'Aluguel / conta da casa'),
             jsonb_build_object('v', 'assinaturas', 'r', 'Assinatura / mensalidade'),
             jsonb_build_object('v', 'parcelas', 'r', 'Parcela / empréstimo'),
             jsonb_build_object('v', 'pix_pessoas', 'r', 'Pix pra pessoa mesmo'))
      from semregra
     where chave is not null and recorrente and categoria = 'pix_pessoas' and confianca <> 'usuario'
       and chave not in (select chave from pes)
     group by chave),
  -- e) lugar que a IA nao reconheceu, com valor relevante
  q_nsei as (
    select 'nao_sei'::text, chave, chave, null::uuid, (array_agg(comerciante order by valor desc))[1], count(*)::int, sum(valor),
           count(distinct date_trunc('month', data))::int, '{}'::jsonb,
           jsonb_build_array(
             jsonb_build_object('v', 'mercado', 'r', 'Mercado / rancho'),
             jsonb_build_object('v', 'mercadoria', 'r', 'Mercadoria / fornecedor'),
             jsonb_build_object('v', 'restaurante', 'r', 'Bares e lanches'),
             jsonb_build_object('v', 'contas_casa', 'r', 'Conta da casa'),
             jsonb_build_object('v', 'outros', 'r', 'Outra coisa'))
      from semregra
     where chave is not null and movimento = 'normal' and categoria = 'nao_identificado' and confianca <> 'usuario'
     group by chave having sum(valor) >= 150),
  -- f) lancamento generico ("PIX ENVIADO") com valor alto: pergunta um por um
  q_lanc as (
    select 'lancamento'::text, id::text, null::text, id, descricao, 1, valor, 1,
           jsonb_build_object('data', data, 'banco', banco),
           jsonb_build_array(
             jsonb_build_object('v', 'mercado', 'r', 'Mercado / rancho'),
             jsonb_build_object('v', 'mercadoria', 'r', 'Mercadoria / fornecedor'),
             jsonb_build_object('v', 'contas_casa', 'r', 'Conta da casa'),
             jsonb_build_object('v', 'pix_pessoas', 'r', 'Pix pra uma pessoa'),
             jsonb_build_object('v', '__minha_conta', 'r', 'Mandei pra outra conta minha'))
      from l
     where chave is null and movimento = 'normal' and categoria in ('nao_identificado', 'pix_pessoas')
       and confianca <> 'usuario' and valor >= 150),
  todas as (
    select * from q_conta union all select * from q_pes union all select * from q_inc
    union all select * from q_rec union all select * from q_nsei union all select * from q_lanc),
  top as (select * from todas order by total desc limit 25),
  ins as (
    insert into public.extrato_perguntas (user_id, motivo, alvo, chave, lancamento_id, tipo, nome, qtd, total, meses, dados, opcoes)
    select p_uid, t.motivo, t.alvo, t.chave, t.lanc, 'saida', t.nome, t.qtd, t.total, t.meses, t.dados, t.opcoes from top t
    on conflict (user_id, motivo, alvo) do update
      set nome = excluded.nome, qtd = excluded.qtd, total = excluded.total, meses = excluded.meses,
          dados = excluded.dados, opcoes = excluded.opcoes
      where public.extrato_perguntas.status = 'aberta'
    returning 1)
  delete from public.extrato_perguntas p
   where p.user_id = p_uid and p.status = 'aberta'
     and not exists (select 1 from top t where t.motivo = p.motivo and t.alvo = p.alvo);

  select count(*) into v_perg from public.extrato_perguntas where user_id = p_uid and status = 'aberta';

  return jsonb_build_object('pares', v_pares, 'entre_contas', v_ec, 'consolidados', v_padrao,
                            'recorrentes', v_rec, 'perguntas', v_perg);
end $$;

-- O proprio usuario pode reanalisar os PROPRIOS dados (usado pelos RPCs abaixo).
create or replace function public.extrato_reanalisar() returns jsonb
language sql security definer set search_path = public as $$
  select public.extrato_analisar_padroes(auth.uid())
$$;

-- =====================================================================================
-- 4) leitura (security invoker: RLS garante que cada um so ve o seu)
-- =====================================================================================
create or replace function public.extrato_base(p_ini date, p_fim date)
returns table (id uuid, data date, hora time, descricao text, comerciante text, chave text, valor numeric,
               tipo text, categoria text, esfera text, confianca text, banco text, movimento text,
               par_id uuid, recorrente boolean, origem text, conta boolean)
language sql stable security invoker set search_path = public as $$
  select l.id, l.data, l.hora, l.descricao, l.comerciante, l.chave, l.valor, l.tipo, l.categoria, l.esfera,
         l.confianca, l.banco, l.movimento, l.par_id, l.recorrente, l.origem,
         -- "conta" = entra nos totais. Entre contas nunca; fatura so se a fatura detalhada
         -- daquele cartao NAO foi enviada no mes (senao a compra apareceria duas vezes).
         (l.movimento = 'normal' or (l.movimento = 'fatura' and not exists (
            select 1 from public.extrato_arquivos a
             where a.user_id = l.user_id and a.documento = 'cartao' and a.mes = date_trunc('month', l.data)::date
               and (a.banco is not distinct from l.banco
                    or (a.banco is not null and l.descricao_norm like '%' || public.extrato_norm(a.banco) || '%'))))) as conta
    from public.extrato_lancamentos l
   where l.user_id = auth.uid() and l.data >= p_ini and l.data < p_fim
$$;

create or replace function public.extrato_resumo(p_mes date)
returns jsonb
language plpgsql security invoker stable set search_path = public as $$
declare
  v_ini date := date_trunc('month', p_mes)::date;
  v_fim date := (date_trunc('month', p_mes) + interval '1 month')::date;
  v_ant date := (date_trunc('month', p_mes) - interval '1 month')::date;
  t record; v_cats jsonb; v_viloes jsonb; v_arquivos jsonb; v_contas jsonb; v_rec jsonb; v_perg int;
begin
  select coalesce(sum(valor) filter (where tipo = 'saida' and conta), 0) saiu,
         coalesce(sum(valor) filter (where tipo = 'entrada' and conta), 0) entrou,
         count(*) qtd,
         array_agg(distinct banco) filter (where banco is not null) bancos,
         coalesce(sum(valor) filter (where tipo = 'saida' and conta and esfera = 'corre'), 0) corre,
         coalesce(sum(valor) filter (where tipo = 'saida' and conta and esfera = 'pessoal'), 0) pessoal,
         count(*) filter (where categoria = 'nao_identificado' and conta) nid,
         coalesce(sum(valor) filter (where tipo = 'saida' and movimento = 'entre_contas'), 0) ec_saiu,
         coalesce(sum(valor) filter (where tipo = 'entrada' and movimento = 'entre_contas'), 0) ec_entrou,
         count(*) filter (where movimento = 'entre_contas') ec_qtd,
         count(*) filter (where movimento = 'entre_contas' and tipo = 'saida' and par_id is not null) ec_pares,
         coalesce(sum(valor) filter (where movimento = 'fatura'), 0) fatura,
         coalesce(bool_or(movimento = 'fatura' and not conta), false) fatura_detalhada,
         coalesce(sum(valor) filter (where tipo = 'entrada' and conta and esfera = 'corre'), 0) vendas,
         count(*) filter (where tipo = 'entrada' and conta and esfera = 'corre') vendas_qtd,
         count(*) filter (where origem = 'manual') manuais
    into t
    from public.extrato_base(v_ini, v_fim);

  with atual as (
    select categoria, esfera, sum(valor) total, count(*) qtd from public.extrato_base(v_ini, v_fim)
     where tipo = 'saida' and conta group by 1, 2),
  anterior as (
    select categoria, sum(valor) total from public.extrato_base(v_ant, v_ini)
     where tipo = 'saida' and conta group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
      'categoria', a.categoria, 'rotulo', c.rotulo, 'icone', c.icone, 'esfera', a.esfera,
      'total', a.total, 'qtd', a.qtd,
      'pct', case when t.saiu > 0 then round(a.total / t.saiu * 100) else 0 end,
      'anterior', coalesce(n.total, 0)) order by a.total desc), '[]'::jsonb)
    into v_cats
    from atual a left join public.extrato_categorias c on c.slug = a.categoria
    left join anterior n on n.categoria = a.categoria;

  with b as (select * from public.extrato_base(v_ini, v_fim) where tipo = 'saida' and conta),
  atual as (
    select categoria, sum(valor) total, count(*) qtd, round(avg(valor), 2) media from b
     where esfera = 'pessoal' and categoria not in ('transferencia_propria', 'nao_identificado', 'fatura_cartao')
     group by 1 order by 2 desc limit 3),
  anterior as (
    select categoria, sum(valor) total from public.extrato_base(v_ant, v_ini) where tipo = 'saida' and conta group by 1),
  top_com as (
    select distinct on (b.categoria) b.categoria, coalesce(b.comerciante, b.chave) comerciante, sum(b.valor) total, count(*) qtd
      from b join atual a on a.categoria = b.categoria
     group by b.categoria, coalesce(b.comerciante, b.chave) order by b.categoria, sum(b.valor) desc),
  madrugada as (
    select categoria, count(*) qtd from b where hora is not null and (hora >= '23:00' or hora < '05:00') group by 1)
  select coalesce(jsonb_agg(jsonb_build_object(
      'categoria', a.categoria, 'rotulo', c.rotulo, 'icone', c.icone, 'total', a.total, 'qtd', a.qtd, 'media', a.media,
      'anterior', coalesce(n.total, 0), 'top_comerciante', tc.comerciante, 'top_total', tc.total, 'top_qtd', tc.qtd,
      'madrugada', coalesce(m.qtd, 0)) order by a.total desc), '[]'::jsonb)
    into v_viloes
    from atual a left join public.extrato_categorias c on c.slug = a.categoria
    left join anterior n on n.categoria = a.categoria
    left join top_com tc on tc.categoria = a.categoria left join madrugada m on m.categoria = a.categoria;

  select coalesce(jsonb_agg(jsonb_build_object(
      'banco', b.banco, 'uso', coalesce(c.uso, 'pessoal'), 'auto', coalesce(c.auto, true),
      'saiu', b.saiu, 'entrou', b.entrou, 'qtd', b.qtd) order by b.entrou desc), '[]'::jsonb)
    into v_contas
    from (select banco,
                 coalesce(sum(valor) filter (where tipo = 'saida' and conta), 0) saiu,
                 coalesce(sum(valor) filter (where tipo = 'entrada' and conta), 0) entrou,
                 count(*) qtd
            from public.extrato_base(v_ini, v_fim) where banco is not null group by banco) b
    left join public.extrato_contas c on c.user_id = auth.uid() and c.banco = b.banco;

  select coalesce(jsonb_agg(x order by (x ->> 'total')::numeric desc), '[]'::jsonb) into v_rec
    from (select jsonb_build_object('chave', chave, 'nome', (array_agg(coalesce(comerciante, chave) order by data desc))[1],
                                    'categoria', (array_agg(categoria order by data desc))[1],
                                    'total', sum(valor), 'qtd', count(*)) x
            from public.extrato_base(v_ini, v_fim)
           where recorrente and tipo = 'saida' and conta group by chave order by sum(valor) desc limit 6) r;

  select count(*) into v_perg from public.extrato_perguntas where user_id = auth.uid() and status = 'aberta';

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'banco', banco, 'lancamentos', lancamentos, 'inicio', periodo_inicio,
                                               'fim', periodo_fim, 'origem', origem, 'quando', criado_em) order by criado_em desc), '[]'::jsonb)
    into v_arquivos from public.extrato_arquivos where user_id = auth.uid() and mes = v_ini;

  return jsonb_build_object(
    'mes', v_ini, 'saiu', t.saiu, 'entrou', t.entrou, 'lancamentos', t.qtd, 'bancos', coalesce(t.bancos, '{}'),
    'corre', t.corre, 'pessoal', t.pessoal, 'nao_identificados', t.nid,
    'entre_contas', jsonb_build_object('saiu', t.ec_saiu, 'entrou', t.ec_entrou, 'qtd', t.ec_qtd, 'pares', t.ec_pares),
    'fatura', jsonb_build_object('total', t.fatura, 'detalhada', t.fatura_detalhada),
    'vendas', t.vendas, 'vendas_qtd', t.vendas_qtd, 'manuais', t.manuais,
    'contas', v_contas, 'recorrentes', v_rec, 'perguntas', v_perg,
    'categorias', v_cats, 'viloes', v_viloes, 'arquivos', v_arquivos);
end $$;

drop function if exists public.extrato_lista(date, text, text);
create function public.extrato_lista(p_mes date, p_categoria text default null, p_tipo text default 'saida')
returns table (id uuid, data date, hora time, descricao text, comerciante text, valor numeric, categoria text,
               esfera text, confianca text, banco text, tipo text, movimento text, recorrente boolean,
               origem text, par_banco text)
language sql security invoker stable set search_path = public as $$
  select b.id, b.data, b.hora, b.descricao, b.comerciante, b.valor, b.categoria, b.esfera, b.confianca, b.banco,
         b.tipo, b.movimento, b.recorrente, b.origem, p.banco
    from public.extrato_base(date_trunc('month', p_mes)::date, (date_trunc('month', p_mes) + interval '1 month')::date) b
    left join public.extrato_lancamentos p on p.id = b.par_id
   where case when p_categoria = '__entre_contas'
              then b.movimento = 'entre_contas' and (p_tipo is null or b.tipo = p_tipo)
              else b.movimento <> 'entre_contas' and (p_tipo is null or b.tipo = p_tipo)
                   and (p_categoria is null or b.categoria = p_categoria) end
   order by b.data desc, b.hora desc nulls last, b.valor desc
$$;

-- =====================================================================================
-- 5) escrita pelo usuario
-- =====================================================================================
-- "Mover": corrige um lancamento e ensina a regra pra mesma contraparte (por chave + tipo).
-- Descricao generica (sem chave) muda so aquele lancamento — antes, mover um "PIX" mudava todos.
create or replace function public.extrato_mover(p_id uuid, p_categoria text, p_esfera text default null)
returns int
language plpgsql security invoker set search_path = public as $$
declare v_chave text; v_tipo text; v_ctipo text; v_esf text; v_n int := 0;
begin
  select chave, tipo into v_chave, v_tipo from public.extrato_lancamentos where id = p_id and user_id = auth.uid();
  if v_tipo is null then raise exception 'lancamento nao encontrado'; end if;
  select tipo, coalesce(p_esfera, esfera_padrao) into v_ctipo, v_esf from public.extrato_categorias where slug = p_categoria;
  if v_ctipo is distinct from v_tipo then raise exception 'categoria invalida pra esse lancamento'; end if;
  if v_esf not in ('corre', 'pessoal') then raise exception 'esfera invalida'; end if;

  update public.extrato_lancamentos set categoria = p_categoria, esfera = v_esf, confianca = 'usuario'
   where id = p_id and user_id = auth.uid();
  if v_chave is not null then
    insert into public.extrato_regras_usuario (user_id, comerciante, tipo, categoria, esfera, valor_min)
    values (auth.uid(), v_chave, v_tipo, p_categoria, v_esf, null)
    on conflict (user_id, comerciante, tipo) do update
      set categoria = excluded.categoria, esfera = excluded.esfera, valor_min = null, atualizado_em = now();
    update public.extrato_lancamentos set categoria = p_categoria, esfera = v_esf, confianca = 'usuario'
     where user_id = auth.uid() and chave = v_chave and tipo = v_tipo and id <> p_id and movimento <> 'entre_contas';
    get diagnostics v_n = row_count;
  end if;
  perform public.extrato_reanalisar();
  return v_n + 1;
end $$;

-- Responde uma pergunta da Vant.
create or replace function public.extrato_responder(p_id uuid, p_resposta text, p_valor_min numeric default null)
returns int
language plpgsql security definer set search_path = public as $$
declare q public.extrato_perguntas; v_ctipo text; v_esf text; v_n int := 0; v_nome text;
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;
  select * into q from public.extrato_perguntas where id = p_id and user_id = auth.uid();
  if q.id is null then raise exception 'pergunta nao encontrada'; end if;
  if q.status <> 'aberta' then return 0; end if;

  if p_resposta = '__ignorar' then
    null;
  elsif p_resposta = '__minha_conta' then
    if q.lancamento_id is not null then
      update public.extrato_lancamentos
         set categoria = case when tipo = 'saida' then 'transferencia_propria' else 'transferencia_recebida' end,
             confianca = 'usuario', esfera = 'pessoal'
       where id = q.lancamento_id and user_id = auth.uid();
      get diagnostics v_n = row_count;
    elsif q.chave is not null then
      select comerciante into v_nome from public.extrato_lancamentos
       where user_id = auth.uid() and chave = q.chave and comerciante is not null
       group by comerciante order by count(*) desc limit 1;
      if v_nome is not null then
        insert into public.extrato_titulares (user_id, nome, origem, confirmado)
        values (auth.uid(), public.extrato_norm(v_nome), 'usuario', true)
        on conflict (user_id, nome) do update set confirmado = true;
      end if;
      -- tira regra antiga que mandava essa chave pra outra categoria
      delete from public.extrato_regras_usuario where user_id = auth.uid() and comerciante = q.chave;
      update public.extrato_lancamentos set confianca = 'ia'
       where user_id = auth.uid() and chave = q.chave and confianca = 'usuario';
      get diagnostics v_n = row_count;
    end if;
  else
    select tipo, esfera_padrao into v_ctipo, v_esf from public.extrato_categorias where slug = p_resposta;
    if v_ctipo is distinct from q.tipo then raise exception 'resposta invalida'; end if;
    if p_valor_min is not null and (p_valor_min <= 0 or p_valor_min > 1000000) then raise exception 'valor minimo invalido'; end if;
    if q.lancamento_id is not null then
      update public.extrato_lancamentos set categoria = p_resposta, esfera = v_esf, confianca = 'usuario'
       where id = q.lancamento_id and user_id = auth.uid();
      get diagnostics v_n = row_count;
    elsif q.chave is not null then
      insert into public.extrato_regras_usuario (user_id, comerciante, tipo, categoria, esfera, valor_min)
      values (auth.uid(), q.chave, q.tipo, p_resposta, v_esf, p_valor_min)
      on conflict (user_id, comerciante, tipo) do update
        set categoria = excluded.categoria, esfera = excluded.esfera, valor_min = excluded.valor_min, atualizado_em = now();
      update public.extrato_lancamentos set categoria = p_resposta, esfera = v_esf, confianca = 'usuario'
       where user_id = auth.uid() and chave = q.chave and tipo = q.tipo and movimento <> 'entre_contas'
         and (p_valor_min is null or valor >= p_valor_min);
      get diagnostics v_n = row_count;
    end if;
  end if;

  update public.extrato_perguntas
     set status = case when p_resposta = '__ignorar' then 'ignorada' else 'respondida' end,
         resposta = left(p_resposta, 40), respondida_em = now()
   where id = p_id;
  perform public.extrato_analisar_padroes(auth.uid());
  return v_n;
end $$;

-- Lancar um gasto (ou entrada) que nao esta em nenhum extrato.
create or replace function public.extrato_lancar_manual(p_data date, p_valor numeric, p_tipo text, p_descricao text,
                                                        p_categoria text, p_banco text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ctipo text; v_esf text; v_desc text; v_banco text; v_id uuid;
begin
  if v_uid is null then raise exception 'nao autenticado'; end if;
  if p_tipo not in ('saida', 'entrada') then raise exception 'tipo invalido'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 1000000 then raise exception 'valor invalido'; end if;
  if p_data is null or p_data > v_hoje + 1 or p_data < v_hoje - 800 then raise exception 'data invalida'; end if;
  select tipo, esfera_padrao into v_ctipo, v_esf from public.extrato_categorias where slug = p_categoria;
  if v_ctipo is distinct from p_tipo then raise exception 'categoria invalida'; end if;
  -- sem numero longo (conta/CPF/chave Pix), curto
  v_desc := trim(left(regexp_replace(regexp_replace(coalesce(p_descricao, ''), '\d{5,}', '', 'g'), '\s+', ' ', 'g'), 60));
  if v_desc = '' then raise exception 'descricao vazia'; end if;
  v_banco := nullif(trim(left(regexp_replace(coalesce(p_banco, ''), '[^[:alnum:] ]', '', 'g'), 40)), '');
  if (select count(*) from public.extrato_lancamentos
       where user_id = v_uid and origem = 'manual' and criado_em > now() - interval '1 day') >= 200 then
    raise exception 'limite diario de lancamentos manuais';
  end if;

  insert into public.extrato_lancamentos (user_id, arquivo_id, data, descricao, descricao_norm, comerciante, chave,
                                          valor, tipo, categoria, esfera, confianca, banco, origem)
  values (v_uid, null, p_data, v_desc,
          -- sufixo aleatorio: dois lancamentos manuais iguais no mesmo dia sao permitidos
          trim(public.extrato_norm(v_desc)) || ' MANUAL ' || upper(translate(substr(md5(gen_random_uuid()::text), 1, 10), '0123456789', 'GHIJKLMNOP')),
          left(trim(public.extrato_norm(v_desc)), 40), public.extrato_chave(v_desc),
          round(p_valor, 2), p_tipo, p_categoria, v_esf, 'usuario', v_banco, 'manual')
  returning id into v_id;
  perform public.extrato_analisar_padroes(v_uid);
  return v_id;
end $$;

create or replace function public.extrato_apagar_manual(p_id uuid) returns boolean
language plpgsql security invoker set search_path = public as $$
declare v_n int;
begin
  delete from public.extrato_lancamentos where id = p_id and user_id = auth.uid() and origem = 'manual';
  get diagnostics v_n = row_count;
  if v_n > 0 then perform public.extrato_reanalisar(); end if;
  return v_n > 0;
end $$;

-- Marcar uma conta como "de vendas" ou "pessoal" (a analise automatica deixa de mexer nela).
create or replace function public.extrato_conta_uso(p_banco text, p_uso text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;
  if p_uso not in ('vendas', 'pessoal') then raise exception 'uso invalido'; end if;
  if not exists (select 1 from public.extrato_lancamentos where user_id = auth.uid() and banco = p_banco) then
    raise exception 'conta nao encontrada';
  end if;
  insert into public.extrato_contas (user_id, banco, uso, auto) values (auth.uid(), p_banco, p_uso, false)
  on conflict (user_id, banco) do update set uso = excluded.uso, auto = false, atualizado_em = now();
  perform public.extrato_analisar_padroes(auth.uid());
end $$;

-- Apagar um arquivo agora tambem refaz a analise (pares/perguntas daquele arquivo somem).
create or replace function public.extrato_apagar_arquivo(p_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from public.extrato_arquivos where id = p_id and user_id = auth.uid();
  perform public.extrato_reanalisar();
end $$;

-- =====================================================================================
-- 6) permissoes
-- =====================================================================================
revoke all on function public.extrato_analisar_padroes(uuid) from public, anon, authenticated;
grant execute on function public.extrato_analisar_padroes(uuid) to service_role;
revoke all on function public.extrato_eh_titular(uuid, text) from public, anon, authenticated;
grant execute on function public.extrato_eh_titular(uuid, text) to service_role;

revoke all on function public.extrato_reanalisar() from public, anon;
revoke all on function public.extrato_responder(uuid, text, numeric) from public, anon;
revoke all on function public.extrato_lancar_manual(date, numeric, text, text, text, text) from public, anon;
revoke all on function public.extrato_apagar_manual(uuid) from public, anon;
revoke all on function public.extrato_conta_uso(text, text) from public, anon;
revoke all on function public.extrato_base(date, date) from public, anon;
revoke all on function public.extrato_lista(date, text, text) from public, anon;
revoke all on function public.extrato_mover(uuid, text, text) from public, anon;
revoke all on function public.extrato_apagar_arquivo(uuid) from public, anon;
grant execute on function public.extrato_reanalisar() to authenticated;
grant execute on function public.extrato_responder(uuid, text, numeric) to authenticated;
grant execute on function public.extrato_lancar_manual(date, numeric, text, text, text, text) to authenticated;
grant execute on function public.extrato_apagar_manual(uuid) to authenticated;
grant execute on function public.extrato_conta_uso(text, text) to authenticated;
grant execute on function public.extrato_base(date, date) to authenticated;
grant execute on function public.extrato_lista(date, text, text) to authenticated;
grant execute on function public.extrato_mover(uuid, text, text) to authenticated;
grant execute on function public.extrato_apagar_arquivo(uuid) to authenticated;
grant execute on function public.extrato_tokens(text) to authenticated, service_role;
grant execute on function public.extrato_chave(text) to authenticated, service_role;

-- =====================================================================================
-- 7) conserto dos dados que ja existem
-- =====================================================================================
-- a) banco perdido nas partes 2..N do PDF (so a 1a pagina tem o cabecalho): herda do
--    arquivo anterior do mesmo envio (ate 10 min antes)
update public.extrato_arquivos a
   set banco = (select b.banco from public.extrato_arquivos b
                 where b.user_id = a.user_id and b.banco is not null
                   and b.criado_em < a.criado_em and b.criado_em > a.criado_em - interval '10 minutes'
                 order by b.criado_em desc limit 1)
 where a.banco is null;
update public.extrato_lancamentos l set banco = a.banco
  from public.extrato_arquivos a where l.arquivo_id = a.id and l.banco is null and a.banco is not null;

-- b) entrada com categoria de saida (o "mover" antigo aplicava a regra nas entradas tambem)
update public.extrato_lancamentos l
   set categoria = case when l.descricao_norm ~ '\mPIX\M' then 'pix_recebido' else 'outros_entrada' end,
       esfera = 'pessoal', confianca = 'baixa'
 where l.tipo = 'entrada'
   and exists (select 1 from public.extrato_categorias c where c.slug = l.categoria and c.tipo = 'saida');

-- c) regras antigas (por comerciante) viram regras por chave; regra de nome generico ("PIX") sai
insert into public.extrato_regras_usuario (user_id, comerciante, tipo, categoria, esfera, atualizado_em)
select distinct on (user_id, public.extrato_chave(comerciante))
       user_id, public.extrato_chave(comerciante), 'saida', categoria, esfera, atualizado_em
  from public.extrato_regras_usuario
 where public.extrato_chave(comerciante) is not null and public.extrato_chave(comerciante) <> comerciante
 order by user_id, public.extrato_chave(comerciante), atualizado_em desc
on conflict (user_id, comerciante, tipo) do nothing;
delete from public.extrato_regras_usuario where public.extrato_chave(comerciante) is distinct from comerciante;

-- d) nome do perfil como primeiro titular conhecido
insert into public.extrato_titulares (user_id, nome, origem, confirmado)
select distinct l.user_id, trim(public.extrato_norm(p.nickname)), 'perfil', false
  from public.extrato_lancamentos l join public.public_profiles p on p.user_id = l.user_id
 where length(trim(public.extrato_norm(coalesce(p.nickname, '')))) >= 4
on conflict (user_id, nome) do nothing;

-- e) roda a analise pra quem ja tem extrato
select public.extrato_analisar_padroes(u.user_id) from (select distinct user_id from public.extrato_lancamentos) u;
