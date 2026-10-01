-- Caixa da Vant (Rick, 30/09/2026): painel financeiro dos socios, separado do app.
-- Saldo em conta = soma dos lancamentos pagos que afetam saldo. Tudo que muda fica
-- em caixa_auditoria (quem, quando, antes/depois). So quem esta em caixa_socios entra.

-- ---------- socios ----------
create table if not exists public.caixa_socios (
  user_id uuid primary key,
  nome text not null,
  criado_em timestamptz not null default now()
);
insert into public.caixa_socios (user_id, nome) values
  ('79312077-3496-44b0-b543-4c9f81425425', 'Rick'),
  ('e38b0499-abbc-439d-b592-c8cac4c83741', 'Mohamed')
on conflict (user_id) do update set nome = excluded.nome;

create or replace function public.caixa_eh_socio() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.caixa_socios where user_id = auth.uid())
$$;
grant execute on function public.caixa_eh_socio() to authenticated;

-- ---------- lancamentos (o extrato) ----------
create table if not exists public.caixa_lancamentos (
  id uuid primary key default gen_random_uuid(),
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  tipo text not null check (tipo in ('entrada','saida','ajuste')),
  valor numeric(12,2) not null,                 -- COM sinal: entrada > 0, saida < 0, ajuste qualquer
  descricao text not null,
  categoria text not null default 'outros',     -- marketing | influenciador | ia | infra | open_finance | premios | ferramentas | impostos | retirada | saque_hotmart | ajuste | outros
  origem text not null default 'manual' check (origem in ('manual','anthropic','openai','hotmart','recorrente','influenciador','ajuste')),
  status text not null default 'pago' check (status in ('pago','a_pagar')),
  afeta_saldo boolean not null default true,    -- consumo de credito pre-pago (API) NAO mexe no caixa
  moeda_original text,                          -- 'USD' quando veio de API / recarga em dolar
  valor_original numeric(12,4),
  cambio numeric(8,4),
  influenciador_id uuid,
  chave_externa text unique,                    -- 'anthropic:2026-09-30' etc. (dedupe do sync)
  comprovante_url text,
  obs text,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists caixa_lanc_data on public.caixa_lancamentos (data desc);

-- ---------- influenciadores (o combinado com cada um) ----------
create table if not exists public.caixa_influenciadores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  handle text,
  tipo text not null default 'cache' check (tipo in ('cache','comissao','permuta')),
  combinado text,                               -- "2 videos por mes", "10% recorrente"...
  valor numeric(12,2) not null default 0,       -- quanto pagar por periodo
  periodicidade text not null default 'mensal' check (periodicidade in ('unico','mensal','por_video')),
  proximo_vencimento date,
  pix_chave text,
  cupom text,
  status text not null default 'ativo' check (status in ('ativo','pausado','encerrado')),
  obs text,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- recorrentes (Supabase, Vercel, contador...) ----------
create table if not exists public.caixa_recorrentes (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text not null default 'infra',
  valor numeric(12,2) not null,
  dia smallint not null default 1 check (dia between 1 and 28),
  ativo boolean not null default true,
  ultimo_lancado date,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- config (cambio, tetos, dicas em cache) ----------
create table if not exists public.caixa_config (
  chave text primary key,
  valor jsonb not null,
  atualizado_por uuid,
  atualizado_em timestamptz not null default now()
);
insert into public.caixa_config (chave, valor) values
  ('cambio_usd', '5.50'::jsonb),
  ('tetos', '{"marketing": 600, "ia": 150, "premios": 500}'::jsonb),
  ('hotmart_a_receber', '469.32'::jsonb)
on conflict (chave) do nothing;

-- ---------- auditoria: tudo que muda fica registrado ----------
create table if not exists public.caixa_auditoria (
  id bigserial primary key,
  quando timestamptz not null default now(),
  quem uuid,
  tabela text not null,
  registro_id text,
  acao text not null,
  antes jsonb,
  depois jsonb
);
create or replace function public.caixa_audita() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.caixa_auditoria (quem, tabela, registro_id, acao, depois) values (auth.uid(), tg_table_name, coalesce((to_jsonb(new)->>'id'), (to_jsonb(new)->>'chave')), 'insert', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    new.atualizado_em := now();
    insert into public.caixa_auditoria (quem, tabela, registro_id, acao, antes, depois) values (auth.uid(), tg_table_name, coalesce((to_jsonb(new)->>'id'), (to_jsonb(new)->>'chave')), 'update', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.caixa_auditoria (quem, tabela, registro_id, acao, antes) values (auth.uid(), tg_table_name, coalesce((to_jsonb(old)->>'id'), (to_jsonb(old)->>'chave')), 'delete', to_jsonb(old));
    return old;
  end if;
end $$;
drop trigger if exists caixa_lanc_audit on public.caixa_lancamentos;
create trigger caixa_lanc_audit before insert or update or delete on public.caixa_lancamentos for each row execute function public.caixa_audita();
drop trigger if exists caixa_inf_audit on public.caixa_influenciadores;
create trigger caixa_inf_audit before insert or update or delete on public.caixa_influenciadores for each row execute function public.caixa_audita();
drop trigger if exists caixa_rec_audit on public.caixa_recorrentes;
create trigger caixa_rec_audit before insert or update or delete on public.caixa_recorrentes for each row execute function public.caixa_audita();
drop trigger if exists caixa_cfg_audit on public.caixa_config;
create trigger caixa_cfg_audit before insert or update or delete on public.caixa_config for each row execute function public.caixa_audita();

-- ---------- RLS: so socio ----------
alter table public.caixa_socios enable row level security;
alter table public.caixa_lancamentos enable row level security;
alter table public.caixa_influenciadores enable row level security;
alter table public.caixa_recorrentes enable row level security;
alter table public.caixa_config enable row level security;
alter table public.caixa_auditoria enable row level security;
drop policy if exists caixa_socios_sel on public.caixa_socios;
create policy caixa_socios_sel on public.caixa_socios for select using (public.caixa_eh_socio());
drop policy if exists caixa_lanc_all on public.caixa_lancamentos;
create policy caixa_lanc_all on public.caixa_lancamentos for all using (public.caixa_eh_socio()) with check (public.caixa_eh_socio());
drop policy if exists caixa_inf_all on public.caixa_influenciadores;
create policy caixa_inf_all on public.caixa_influenciadores for all using (public.caixa_eh_socio()) with check (public.caixa_eh_socio());
drop policy if exists caixa_rec_all on public.caixa_recorrentes;
create policy caixa_rec_all on public.caixa_recorrentes for all using (public.caixa_eh_socio()) with check (public.caixa_eh_socio());
drop policy if exists caixa_cfg_all on public.caixa_config;
create policy caixa_cfg_all on public.caixa_config for all using (public.caixa_eh_socio()) with check (public.caixa_eh_socio());
drop policy if exists caixa_aud_sel on public.caixa_auditoria;
create policy caixa_aud_sel on public.caixa_auditoria for select using (public.caixa_eh_socio());

-- ---------- comprovantes (bucket privado) ----------
insert into storage.buckets (id, name, public) values ('caixa-comprovantes', 'caixa-comprovantes', false) on conflict (id) do nothing;
drop policy if exists caixa_comp_sel on storage.objects;
create policy caixa_comp_sel on storage.objects for select using (bucket_id = 'caixa-comprovantes' and public.caixa_eh_socio());
drop policy if exists caixa_comp_ins on storage.objects;
create policy caixa_comp_ins on storage.objects for insert with check (bucket_id = 'caixa-comprovantes' and public.caixa_eh_socio());
drop policy if exists caixa_comp_del on storage.objects;
create policy caixa_comp_del on storage.objects for delete using (bucket_id = 'caixa-comprovantes' and public.caixa_eh_socio());

-- ---------- ajuste de saldo: registra a diferenca como lancamento (nunca some) ----------
create or replace function public.caixa_ajustar_saldo(p_novo_saldo numeric, p_motivo text)
returns numeric language plpgsql security invoker as $$
declare v_atual numeric; v_dif numeric;
begin
  if not public.caixa_eh_socio() then raise exception 'sem acesso'; end if;
  select coalesce(sum(valor), 0) into v_atual from public.caixa_lancamentos where status = 'pago' and afeta_saldo;
  v_dif := round(p_novo_saldo - v_atual, 2);
  if v_dif = 0 then return v_atual; end if;
  insert into public.caixa_lancamentos (tipo, valor, descricao, categoria, origem, status, criado_por)
    values ('ajuste', v_dif, coalesce(nullif(trim(p_motivo), ''), 'Ajuste de saldo'), 'ajuste', 'ajuste', 'pago', auth.uid());
  return p_novo_saldo;
end $$;
grant execute on function public.caixa_ajustar_saldo(numeric, text) to authenticated;

-- ---------- lanca os recorrentes que venceram ate hoje (idempotente) ----------
create or replace function public.caixa_lancar_recorrentes()
returns int language plpgsql security invoker as $$
declare r record; v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_n int := 0; v_data date;
begin
  if not public.caixa_eh_socio() then raise exception 'sem acesso'; end if;
  for r in select * from public.caixa_recorrentes where ativo loop
    v_data := make_date(extract(year from v_hoje)::int, extract(month from v_hoje)::int, r.dia);
    if v_data <= v_hoje and (r.ultimo_lancado is null or r.ultimo_lancado < v_data) then
      insert into public.caixa_lancamentos (data, tipo, valor, descricao, categoria, origem, status, chave_externa, criado_por)
        values (v_data, 'saida', -abs(r.valor), r.descricao, r.categoria, 'recorrente', 'a_pagar', 'rec:' || r.id || ':' || to_char(v_data, 'YYYY-MM'), auth.uid())
        on conflict (chave_externa) do nothing;
      update public.caixa_recorrentes set ultimo_lancado = v_data where id = r.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
grant execute on function public.caixa_lancar_recorrentes() to authenticated;

-- ---------- resumo: a tela inteira numa chamada ----------
create or replace function public.caixa_resumo(p_mes date default null)
returns jsonb language plpgsql security invoker stable as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date := date_trunc('month', coalesce(p_mes, v_hoje))::date;
  v_fim date := (v_ini + interval '1 month')::date;
  v_ant date := (v_ini - interval '1 month')::date;
  v_saldo numeric; v_a_pagar numeric; v_entrou numeric; v_saiu numeric; v_saiu_ant numeric;
  v_cats jsonb; v_serie jsonb; v_ia jsonb; v_inf jsonb; v_cfg jsonb; v_media_dia numeric;
begin
  if not public.caixa_eh_socio() then raise exception 'sem acesso'; end if;
  select coalesce(sum(valor),0) into v_saldo from public.caixa_lancamentos where status='pago' and afeta_saldo;
  select coalesce(-sum(valor),0) into v_a_pagar from public.caixa_lancamentos where status='a_pagar' and afeta_saldo;
  select coalesce(sum(valor) filter (where valor > 0 and tipo <> 'ajuste'),0), coalesce(-sum(valor) filter (where valor < 0 and tipo <> 'ajuste'),0)
    into v_entrou, v_saiu from public.caixa_lancamentos where afeta_saldo and data >= v_ini and data < v_fim;
  select coalesce(-sum(valor) filter (where valor < 0 and tipo <> 'ajuste'),0) into v_saiu_ant
    from public.caixa_lancamentos where afeta_saldo and data >= v_ant and data < v_ini;

  with atual as (select categoria, -sum(valor) total, count(*) qtd from public.caixa_lancamentos where afeta_saldo and valor < 0 and tipo <> 'ajuste' and data >= v_ini and data < v_fim group by 1),
       anterior as (select categoria, -sum(valor) total from public.caixa_lancamentos where afeta_saldo and valor < 0 and tipo <> 'ajuste' and data >= v_ant and data < v_ini group by 1)
  select coalesce(jsonb_agg(jsonb_build_object('categoria', a.categoria, 'total', a.total, 'qtd', a.qtd, 'anterior', coalesce(n.total,0)) order by a.total desc), '[]'::jsonb)
    into v_cats from atual a left join anterior n on n.categoria = a.categoria;

  -- saldo dia a dia do mes (acumulado desde o inicio)
  with dias as (select generate_series(v_ini, least(v_fim - 1, v_hoje), interval '1 day')::date d),
       ac as (select d, (select coalesce(sum(valor),0) from public.caixa_lancamentos l where l.status='pago' and l.afeta_saldo and l.data <= dias.d) saldo,
                 (select coalesce(sum(valor),0) from public.caixa_lancamentos l where l.status='pago' and l.afeta_saldo and l.data = dias.d and l.valor > 0) entrou,
                 (select coalesce(-sum(valor),0) from public.caixa_lancamentos l where l.status='pago' and l.afeta_saldo and l.data = dias.d and l.valor < 0) saiu
              from dias)
  select coalesce(jsonb_agg(jsonb_build_object('d', d, 'saldo', saldo, 'entrou', entrou, 'saiu', saiu) order by d), '[]'::jsonb) into v_serie from ac;

  -- IA: recargas (dinheiro que saiu) x consumo (API), por provedor, no mes e total
  select jsonb_build_object(
    'anthropic', jsonb_build_object(
       'recargas_total', coalesce(-sum(valor) filter (where origem='manual' and categoria='ia' and descricao ilike '%anthropic%' and afeta_saldo),0),
       'consumo_total', coalesce(-sum(valor) filter (where origem='anthropic'),0),
       'consumo_mes', coalesce(-sum(valor) filter (where origem='anthropic' and data >= v_ini and data < v_fim),0),
       'consumo_7d', coalesce(-sum(valor) filter (where origem='anthropic' and data > v_hoje - 7),0),
       'ultimo', max(data) filter (where origem='anthropic')),
    'openai', jsonb_build_object(
       'recargas_total', coalesce(-sum(valor) filter (where origem='manual' and categoria='ia' and descricao ilike '%openai%' and afeta_saldo),0),
       'consumo_total', coalesce(-sum(valor) filter (where origem='openai'),0),
       'consumo_mes', coalesce(-sum(valor) filter (where origem='openai' and data >= v_ini and data < v_fim),0),
       'consumo_7d', coalesce(-sum(valor) filter (where origem='openai' and data > v_hoje - 7),0),
       'ultimo', max(data) filter (where origem='openai')))
  into v_ia from public.caixa_lancamentos;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'handle', handle, 'tipo', tipo, 'combinado', combinado, 'valor', valor,
      'periodicidade', periodicidade, 'proximo_vencimento', proximo_vencimento, 'pix_chave', pix_chave, 'cupom', cupom, 'status', status, 'obs', obs,
      'pago_mes', (select coalesce(-sum(valor),0) from public.caixa_lancamentos l where l.influenciador_id = i.id and l.status='pago' and l.data >= v_ini and l.data < v_fim),
      'pago_total', (select coalesce(-sum(valor),0) from public.caixa_lancamentos l where l.influenciador_id = i.id and l.status='pago'))
      order by status, proximo_vencimento nulls last), '[]'::jsonb)
    into v_inf from public.caixa_influenciadores i;

  select coalesce(jsonb_object_agg(chave, valor), '{}'::jsonb) into v_cfg from public.caixa_config where chave <> 'dicas';
  select coalesce(-sum(valor),0) / 30.0 into v_media_dia from public.caixa_lancamentos where afeta_saldo and valor < 0 and tipo <> 'ajuste' and data > v_hoje - 30;

  return jsonb_build_object('mes', v_ini, 'hoje', v_hoje, 'saldo', v_saldo, 'a_pagar', v_a_pagar, 'entrou', v_entrou, 'saiu', v_saiu, 'saiu_anterior', v_saiu_ant,
    'media_dia_30', round(v_media_dia, 2), 'categorias', v_cats, 'serie', v_serie, 'ia', v_ia, 'influenciadores', v_inf, 'config', v_cfg,
    'dicas', (select valor from public.caixa_config where chave = 'dicas'));
end $$;
grant execute on function public.caixa_resumo(date) to authenticated;

-- ---------- ponto de partida (Rick, 30/09/2026): saldo da Hotmart e a recarga da Anthropic ----------
insert into public.caixa_lancamentos (data, tipo, valor, descricao, categoria, origem, status, chave_externa, obs, criado_por)
values ('2026-09-30', 'entrada', 544.16, 'Saldo inicial — Hotmart (R$ 74,84 disponível + R$ 469,32 a receber)', 'saque_hotmart', 'hotmart', 'pago', 'inicial:hotmart:2026-09-30', 'Ponto de partida do painel. Tudo antes disso ficou de fora de propósito.', '79312077-3496-44b0-b543-4c9f81425425')
on conflict (chave_externa) do nothing;
insert into public.caixa_lancamentos (data, tipo, valor, descricao, categoria, origem, status, moeda_original, valor_original, cambio, chave_externa, criado_por)
values ('2026-09-30', 'saida', -82.50, 'Recarga Anthropic (US$ 15)', 'ia', 'manual', 'pago', 'USD', 15, 5.50, 'inicial:anthropic:2026-09-30', '79312077-3496-44b0-b543-4c9f81425425')
on conflict (chave_externa) do nothing;
