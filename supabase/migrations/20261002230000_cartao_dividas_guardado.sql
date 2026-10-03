-- ============================================================
-- CARTÃO, DÍVIDAS E GUARDADO (etapa 4 do Open Finance) — 02/10/2026
-- Lidos UMA vez por dia, de madrugada, pela pluggy-dia (design v4):
--   • bank_cartoes:      fatura atual, limite, vencimento, mínimo
--   • bank_parcelas:     compras parceladas no cartão que ainda têm parcela por vir
--   • bank_emprestimos:  empréstimos/financiamentos: parcela, quantas faltam, taxa
--   • bank_investimentos:o "guardado" conferido pelo banco (caixinha, CDB…)
--   • bank_saldos ganha o cheque especial (limite e usado)
-- Nunca guarda número de contrato, agência ou conta. Só o dono lê; só o servidor grava.
-- financas_painel(): tudo das telas Cartão, Dívidas e Guardado + "seu número".
-- Idempotente e sem comandos de apagar.
-- ============================================================

alter table public.bank_saldos add column if not exists cheque_limite numeric(14,2);
alter table public.bank_saldos add column if not exists cheque_usado numeric(14,2);

create table if not exists public.bank_cartoes (
  conta_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_connection_id uuid references public.bank_connections(id) on delete cascade,
  banco text, nome text,
  fatura numeric(14,2),        -- saldo da fatura atual
  limite numeric(14,2),
  disponivel numeric(14,2),
  vence date, fecha date,
  minimo numeric(14,2),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.bank_parcelas (
  pluggy_tx_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  conta_id text,
  banco text, descricao text,
  valor_parcela numeric(14,2) not null,
  parcela_atual int not null,
  parcelas_total int not null,
  data_compra date,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.bank_emprestimos (
  pluggy_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_connection_id uuid references public.bank_connections(id) on delete cascade,
  banco text, nome text, tipo text,
  valor_contratado numeric(14,2),
  saldo_devedor numeric(14,2),
  parcela_valor numeric(14,2),
  parcelas_total int, parcelas_pagas int, parcelas_atrasadas int,
  taxa_mes numeric(8,4),        -- % ao mês (0.029 = 2,9%)
  proximo_vencimento date,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.bank_investimentos (
  pluggy_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_connection_id uuid references public.bank_connections(id) on delete cascade,
  banco text, nome text, tipo text,
  saldo numeric(14,2),
  atualizado_em timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['bank_cartoes','bank_parcelas','bank_emprestimos','bank_investimentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t || '_dono_le') then
      execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_dono_le', t);
    end if;
  end loop;
end $$;

create or replace function public.financas_painel()
returns jsonb
language sql stable security invoker set search_path to 'public' as $$
  with eu as (select auth.uid() as uid),
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  con as (select id from public.bank_connections where user_id = (select uid from eu) and coalesce(status,'') <> 'deleted'),
  cart as (select * from public.bank_cartoes where user_id = (select uid from eu) and bank_connection_id in (select id from con)),
  parc as (select * from public.bank_parcelas where user_id = (select uid from eu) and parcela_atual < parcelas_total),
  emp as (select * from public.bank_emprestimos where user_id = (select uid from eu) and bank_connection_id in (select id from con)
               and coalesce(saldo_devedor, 0) > 0),   -- quitado não é dívida
  inv as (select * from public.bank_investimentos where user_id = (select uid from eu) and bank_connection_id in (select id from con) and coalesce(saldo,0) > 0),
  sal as (select * from public.bank_saldos where user_id = (select uid from eu) and bank_connection_id in (select id from con)),
  -- parcelas futuras por mês: a parcela k (k = atual+1..total) cai k-atual meses depois
  meses as (
    select (date_trunc('month', (select d from hoje)) + make_interval(months => g))::date as mes,
           sum(p.valor_parcela) as valor
      from parc p, generate_series(1, 12) g
     where g <= p.parcelas_total - p.parcela_atual
     group by 1
  ),
  especial as (
    select coalesce(sum(greatest(coalesce(cheque_usado,0), case when saldo < 0 then -saldo else 0 end)),0) as usado from sal
  ),
  -- "um dia de rua": o lucro médio dos dias trabalhados nos últimos 30 dias
  rua as (
    select avg(ds.total_profit)::numeric as media
      from public.daily_sales ds
     where ds.user_id = (select uid from eu) and ds.date::date >= (select d from hoje) - 30 and coalesce(ds.total_profit, 0) > 0
  ),
  juros as (
    select
      coalesce((select sum(coalesce(saldo_devedor, parcela_valor * greatest(parcelas_total - coalesce(parcelas_pagas,0),0)) * coalesce(taxa_mes,0)) from emp), 0) as emprestimo,
      (select usado from especial) * 0.08 as especial   -- sem taxa do banco: 8% a.m., média do cheque especial
  )
  select jsonb_build_object(
    'tem_cartao', exists (select 1 from cart),
    'cartoes', coalesce((select jsonb_agg(jsonb_build_object('banco', banco, 'nome', nome, 'fatura', fatura, 'limite', limite,
                 'disponivel', disponivel, 'vence', vence, 'fecha', fecha, 'minimo', minimo, 'atualizado', atualizado_em)
                 order by vence nulls last) from cart), '[]'::jsonb),
    'parcelas', coalesce((select jsonb_agg(jsonb_build_object('descricao', descricao, 'banco', banco, 'valor', valor_parcela,
                 'atual', parcela_atual, 'total', parcelas_total,
                 'ate', (date_trunc('month', (select d from hoje)) + make_interval(months => parcelas_total - parcela_atual))::date)
                 order by valor_parcela desc) from parc), '[]'::jsonb),
    'parcelas_por_mes', coalesce((select jsonb_agg(jsonb_build_object('mes', mes, 'valor', valor) order by mes) from meses), '[]'::jsonb),
    'parcelas_mes', coalesce((select valor from meses order by mes limit 1), 0),
    'parcelas_total', coalesce((select sum(valor_parcela * (parcelas_total - parcela_atual)) from parc), 0),
    'tem_emprestimo', exists (select 1 from emp),
    'emprestimos', coalesce((select jsonb_agg(jsonb_build_object('banco', banco, 'nome', nome, 'tipo', tipo,
                 'saldo_devedor', coalesce(saldo_devedor, parcela_valor * greatest(parcelas_total - coalesce(parcelas_pagas,0),0)),
                 'parcela', parcela_valor, 'total', parcelas_total, 'pagas', parcelas_pagas, 'atrasadas', parcelas_atrasadas,
                 'taxa_mes', taxa_mes, 'vence', proximo_vencimento)
                 order by taxa_mes desc nulls last) from emp), '[]'::jsonb),
    'especial_usado', (select usado from especial),
    'especial_limite', coalesce((select sum(cheque_limite) from sal), 0),
    'juros_mes', jsonb_build_object('emprestimo', round((select emprestimo from juros), 2), 'especial', round((select especial from juros), 2)),
    'tem_investimento', exists (select 1 from inv),
    'investimentos', coalesce((select jsonb_agg(jsonb_build_object('banco', banco, 'nome', nome, 'tipo', tipo, 'saldo', saldo)
                 order by saldo desc) from inv), '[]'::jsonb),
    'guardado', coalesce((select sum(saldo) from inv), 0),
    'saldo_contas', coalesce((select sum(saldo) from sal), 0),
    'dividas', coalesce((select sum(coalesce(saldo_devedor, parcela_valor * greatest(parcelas_total - coalesce(parcelas_pagas,0),0))) from emp), 0)
               + coalesce((select sum(fatura) from cart where fatura > 0), 0)
               + coalesce((select sum(valor_parcela * (parcelas_total - parcela_atual)) from parc), 0)
               + (select usado from especial),
    'dia_de_rua', round(coalesce((select media from rua), 0), 2),
    'leitura', (select max(atualizado_em) from (select atualizado_em from cart union all select atualizado_em from emp union all select atualizado_em from inv) x)
  );
$$;
grant execute on function public.financas_painel() to authenticated;
