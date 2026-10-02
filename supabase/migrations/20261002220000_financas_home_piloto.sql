-- ============================================================
-- FINANÇAS HOME + PILOTO AUTOMÁTICO (etapa 3 do Open Finance) — 02/10/2026
--   • bank_saldos: o saldo de cada conta BANK lida pela Pluggy (o pluggy-hora
--     grava de hora em hora). É o "quanto você tem agora".
--   • extrato_lancamentos.pluggy_tx_id: cada movimentação do banco entra no
--     Raio-X uma vez só (Piloto Automático). Sem número de conta: só o id da Pluggy.
--   • financas_home(): tudo que a home de Finanças precisa numa chamada só:
--     saldo, fôlego, entrou/saiu/sobrou do mês, o alerta mais urgente e o
--     que o Piloto Automático já organizou. Roda como o próprio vendedor (RLS).
-- Idempotente.
-- ============================================================

alter table public.extrato_lancamentos add column if not exists pluggy_tx_id text;
create unique index if not exists extrato_lancamentos_pluggy_tx_uidx
  on public.extrato_lancamentos (user_id, pluggy_tx_id) where pluggy_tx_id is not null;

create table if not exists public.bank_saldos (
  conta_id text primary key,                 -- id da conta na Pluggy
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_connection_id uuid references public.bank_connections(id) on delete cascade,
  banco text,
  nome text,
  saldo numeric(14,2),
  atualizado_em timestamptz not null default now()
);
create index if not exists bank_saldos_user_idx on public.bank_saldos (user_id);
alter table public.bank_saldos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bank_saldos' and policyname='bank_saldos_dono_le') then
    create policy bank_saldos_dono_le on public.bank_saldos for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;
-- escrita só pelo servidor (service role); sem policy de insert/update

create or replace function public.financas_home()
returns jsonb
language sql stable security invoker set search_path to 'public' as $$
  with eu as (select auth.uid() as uid),
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  mes as (select date_trunc('month', (select d from hoje))::date as ini,
                 (date_trunc('month', (select d from hoje)) + interval '1 month')::date as fim),
  conexoes as (
    select id from public.bank_connections
     where user_id = (select uid from eu) and coalesce(status, '') <> 'deleted'
  ),
  saldos as (
    select s.banco, s.saldo, s.atualizado_em
      from public.bank_saldos s
     where s.user_id = (select uid from eu)
       and s.bank_connection_id in (select id from conexoes)
       and s.saldo is not null
  ),
  fixas as (
    select coalesce(sum(b.amount), 0)::numeric as total
      from public.planned_bills b
     where b.user_id = (select uid from eu)
       and coalesce(b.recurring, false)
       and (b.duration_months is null or coalesce(b.cycles_paid, 0) < b.duration_months)
  ),
  base as (select * from public.extrato_base((select ini from mes), (select fim from mes)) where conta),
  -- vencimento de cada conta neste ciclo (dia do due_date, preso ao fim do mês)
  contas as (
    select b.name, (b.amount - coalesce(b.saved_amount, 0))::numeric as falta,
           case when coalesce(b.recurring, false) then
             make_date(extract(year from (select d from hoje))::int, extract(month from (select d from hoje))::int,
               least(extract(day from b.due_date)::int,
                     extract(day from ((select fim from mes) - 1))::int))
           else b.due_date end as vence
      from public.planned_bills b
     where b.user_id = (select uid from eu)
       and b.due_date is not null
       and not coalesce(b.paid, false)
       and coalesce(b.paid_cycle, '') <> to_char((select d from hoje), 'YYYY-MM')
  ),
  tot as (
    select (select sum(saldo) from saldos) as saldo,
           (select total from fixas) as fixas,
           coalesce((select sum(valor) from base where tipo = 'entrada'), 0) as entrou,
           coalesce((select sum(valor) from base where tipo = 'saida'), 0) as saiu
  )
  select jsonb_build_object(
    'tem_banco', exists (select 1 from conexoes),
    'tem_saldo', exists (select 1 from saldos),
    'saldo', (select saldo from tot),
    'bancos', coalesce((select jsonb_agg(jsonb_build_object('banco', banco, 'saldo', s) order by s desc)
                          from (select banco, sum(saldo) s from saldos group by banco) x), '[]'::jsonb),
    'atualizado', (select max(atualizado_em) from saldos),
    'fixas_mes', (select fixas from tot),
    'folego_dias', case when (select fixas from tot) > 0 and coalesce((select saldo from tot), 0) > 0
                        then floor((select saldo from tot) / ((select fixas from tot) / 30.0))::int end,
    'entrou', (select entrou from tot),
    'saiu', (select saiu from tot),
    'sobrou', (select entrou - saiu from tot),
    'alerta', coalesce(
      case when (select saldo from tot) < 0 then jsonb_build_object('tipo', 'negativo') end,
      (select jsonb_build_object('tipo', 'vencida', 'nome', name, 'valor', falta, 'dia', vence)
         from contas where vence < (select d from hoje) and falta > 0 order by vence limit 1),
      (select jsonb_build_object('tipo', 'vence', 'nome', name, 'valor', falta, 'dia', vence,
                                 'sobra', coalesce((select saldo from tot), 0) - falta)
         from contas where vence between (select d from hoje) and (select d from hoje) + 7 and falta > 0
         order by vence limit 1)
    ),
    'causas', case when (select saldo from tot) < 0 then
      coalesce((select jsonb_agg(jsonb_build_object('descricao', descricao, 'categoria', categoria, 'valor', valor, 'data', data))
                  from (select descricao, categoria, valor, data from public.extrato_base((select d from hoje) - 7, (select d from hoje) + 1)
                         where conta and tipo = 'saida' order by valor desc limit 4) c), '[]'::jsonb) end,
    'piloto', jsonb_build_object(
      'lancamentos', (select count(*) from base where origem = 'pluggy' and tipo = 'saida'),
      'conferir', (select count(*) from base where origem = 'pluggy' and tipo = 'saida' and categoria = 'nao_identificado')
    )
  );
$$;
grant execute on function public.financas_home() to authenticated;
