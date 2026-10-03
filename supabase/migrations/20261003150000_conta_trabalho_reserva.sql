-- ============================================================
-- CONTA DE TRABALHO × CONTA DE RESERVA + LIMITE DE BANCOS — 03/10/2026
-- Rick (12h13): "o C6 é o banco de trabalho (fluxo de caixa) e o Santander é a
-- reserva de emergência". E: "o Vant Pro conecta UMA conta; quer outra, paga
-- R$ 10 a mais. Quem não tem limite: só eu e o Mohamed."
--   • bank_connections.papel: 'trabalho' | 'reserva' (o vendedor escolhe uma vez)
--   • bancos_extra: quantas contas a mais cada um comprou; isento = sem limite
--   • open_finance_limite(): quantas usa, quantas pode, se pode ligar mais uma
--     (a trava de verdade está no pluggy-connect-token: sem vaga, nem abre o banco)
--   • bank_connections só recebe INSERT do servidor (antes o app podia inserir
--     uma conexão sem banco nenhum e ganhar o selo)
--   • financas_home(): saldo separado em fluxo de caixa e reserva + "precisa_papel"
-- Idempotente, sem comandos de apagar.
-- ============================================================

alter table public.bank_connections add column if not exists papel text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bank_connections_papel_chk') then
    alter table public.bank_connections add constraint bank_connections_papel_chk
      check (papel is null or papel in ('trabalho', 'reserva'));
  end if;
end $$;

create table if not exists public.bancos_extra (
  user_id uuid primary key references auth.users(id) on delete cascade,
  extras int not null default 0 check (extras >= 0),
  isento boolean not null default false,
  nota text,
  atualizado_em timestamptz not null default now()
);
alter table public.bancos_extra enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bancos_extra' and policyname = 'bancos_extra_dono_le') then
    create policy bancos_extra_dono_le on public.bancos_extra for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;

insert into public.bancos_extra (user_id, isento, nota) values
  ('79312077-3496-44b0-b543-4c9f81425425', true, 'Rick, dono'),
  ('e38b0499-abbc-439d-b592-c8cac4c83741', true, 'Mohamed, sócio')
on conflict (user_id) do update set isento = true;

create or replace function public.open_finance_limite(p_user uuid default null)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with u as (select coalesce(p_user, auth.uid()) as id),
  x as (select * from public.bancos_extra where user_id = (select id from u)),
  usados as (select count(*)::int n from public.bank_connections
              where user_id = (select id from u) and coalesce(status, '') <> 'deleted')
  select jsonb_build_object(
    'usados', (select n from usados),
    'isento', coalesce((select isento from x), false),
    'limite', case when coalesce((select isento from x), false) then null else 1 + coalesce((select extras from x), 0) end,
    'pode_conectar', coalesce((select isento from x), false) or (select n from usados) < 1 + coalesce((select extras from x), 0)
  )
  where (select id from u) is not null
    and (p_user is null or p_user = auth.uid() or auth.role() = 'service_role');
$$;
grant execute on function public.open_finance_limite(uuid) to authenticated;

-- conexão de banco só nasce pelo servidor (pluggy-item / pluggy-webhook, com a chave de serviço)
create or replace function public.bank_connections_so_servidor()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'conexao de banco so pelo servidor';
  end if;
  return new;
end $$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_bank_connections_so_servidor') then
    create trigger trg_bank_connections_so_servidor before insert on public.bank_connections
      for each row execute function public.bank_connections_so_servidor();
  end if;
end $$;

-- Finanças: o saldo separado em fluxo de caixa (trabalho) e reserva.
-- Conta sem papel conta como trabalho. Com 2+ contas e alguma sem papel, o app pergunta UMA vez.
create or replace function public.financas_home()
returns jsonb language sql stable set search_path to 'public' as $$
  with eu as (select auth.uid() as uid),
  hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  mes as (select date_trunc('month', (select d from hoje))::date as ini,
                 (date_trunc('month', (select d from hoje)) + interval '1 month')::date as fim),
  conexoes as (
    select id, institution_name, papel from public.bank_connections
     where user_id = (select uid from eu) and coalesce(status, '') <> 'deleted'
  ),
  saldos as (
    select s.banco, s.saldo, s.atualizado_em, s.bank_connection_id, coalesce(c.papel, 'trabalho') as papel
      from public.bank_saldos s join conexoes c on c.id = s.bank_connection_id
     where s.user_id = (select uid from eu) and s.saldo is not null
  ),
  fixas as (
    select coalesce(sum(b.amount), 0)::numeric as total
      from public.planned_bills b
     where b.user_id = (select uid from eu)
       and coalesce(b.recurring, false)
       and (b.duration_months is null or coalesce(b.cycles_paid, 0) < b.duration_months)
  ),
  base as (select * from public.extrato_base((select ini from mes), (select fim from mes)) where conta),
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
    'saldo_trabalho', (select sum(saldo) from saldos where papel = 'trabalho'),
    'saldo_reserva', (select sum(saldo) from saldos where papel = 'reserva'),
    'precisa_papel', (select count(*) from conexoes) >= 2 and exists (select 1 from conexoes where papel is null),
    'contas', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'banco', c.institution_name, 'papel', c.papel,
                          'saldo', (select sum(s.saldo) from saldos s where s.bank_connection_id = c.id)) order by c.institution_name)
                          from conexoes c), '[]'::jsonb),
    'bancos', coalesce((select jsonb_agg(jsonb_build_object('banco', banco, 'saldo', s, 'papel', papel) order by s desc)
                          from (select banco, papel, sum(saldo) s from saldos group by banco, papel) x), '[]'::jsonb),
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
