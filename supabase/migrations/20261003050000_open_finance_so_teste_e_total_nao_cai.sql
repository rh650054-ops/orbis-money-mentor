-- Aplicada no Supabase em 03/10/2026 ~02:40 (Mohamed, pelo SQL Editor). Só paridade com o banco — NÃO reaplicar.

-- ============================================================
-- VANT — 03/10/2026 — Rodar no Supabase → SQL Editor → Run (tudo de uma vez)
-- Projeto: Orbis Milion (qbcsjsdwjjpybvzbxszi)
--
-- 1) Total do dia NUNCA cai ao fechar o DEFCON (bug antigo, todos os perfis)
-- 2) Open Finance visível só pro perfil de teste (Mohamed, CPF ...034)
-- 3) Ranking = o que o vendedor LANÇA (dinheiro + cartão + Pix), pra todo mundo
-- 4) Dia do Pix = janela do DEFCON (do início de um até o início do próximo)
-- 5) Pix da própria empresa/nome (CNPJ 59.604.945, "MOHAMED ANDRE") não é venda
-- 6) Conserto dos dias 02/10 (Thiago e Mohamed)
-- ============================================================

-- ---------- 1) total_sold nunca fica abaixo das vendas lançadas ----------
create or replace function public.challenge_sessions_total_piso()
returns trigger language plpgsql set search_path to 'public' as $$
declare soma numeric;
begin
  if new.status in ('completed', 'abandoned') and coalesce(old.status, '') = 'active' then
    select coalesce(sum(amount), 0) into soma from public.defcon_sales where session_id = new.id;
    if coalesce(new.total_sold, 0) < soma then new.total_sold := soma; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_challenge_sessions_total_piso on public.challenge_sessions;
create trigger trg_challenge_sessions_total_piso
  before update on public.challenge_sessions
  for each row execute function public.challenge_sessions_total_piso();

-- ---------- 2) quem está testando o Open Finance ----------
create table if not exists public.open_finance_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  nota text
);
alter table public.open_finance_testers enable row level security;
revoke all on public.open_finance_testers from anon, authenticated;

create or replace function public.open_finance_teste(p_user uuid default null)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.open_finance_testers where user_id = coalesce(p_user, auth.uid()));
$$;
revoke all on function public.open_finance_teste(uuid) from public, anon;
grant execute on function public.open_finance_teste(uuid) to authenticated;

insert into public.open_finance_testers (user_id, nota)
values ('e38b0499-abbc-439d-b592-c8cac4c83741', 'perfil de teste do Open Finance (03/10)')
on conflict do nothing;

-- ---------- 5) contas próprias por nome/CNPJ ----------
create table if not exists public.open_finance_contas_proprias (
  user_id uuid not null references auth.users(id) on delete cascade,
  termo text not null,
  criado_em timestamptz not null default now(),
  primary key (user_id, termo)
);
alter table public.open_finance_contas_proprias enable row level security;
revoke all on public.open_finance_contas_proprias from anon, authenticated;

insert into public.open_finance_contas_proprias (user_id, termo) values
  ('e38b0499-abbc-439d-b592-c8cac4c83741', '59.604.945'),
  ('e38b0499-abbc-439d-b592-c8cac4c83741', 'MOHAMED ANDRE')
on conflict do nothing;

update public.auto_detected_sales set own_transfer = true
 where user_id = 'e38b0499-abbc-439d-b592-c8cac4c83741'
   and (description ilike '%59.604.945%' or description ilike '%MOHAMED ANDRE%');

-- ---------- 4) régua do Pix: dia = janela do DEFCON ----------
create or replace function public.banco_pix_por_dia(p_user uuid, p_de date, p_ate date)
returns table(dia date, total numeric, qtd integer, ultimo timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with sess as (
    select cs.date as d, min(cs.started_at) as ini
    from public.challenge_sessions cs
    where cs.user_id = p_user and cs.started_at is not null
      and cs.date between p_de - 3 and p_ate + 3
    group by cs.date
  ),
  tx as (
    select a.amount, a.transacted_at,
           coalesce(
             (select s.d from sess s where s.ini <= a.transacted_at order by s.ini desc limit 1),
             (a.transacted_at at time zone 'America/Sao_Paulo')::date,
             a.transaction_date) as dia
    from public.auto_detected_sales a
    where a.user_id = p_user
      and a.transaction_date between p_de - 2 and p_ate + 2
      and coalesce(a.status, 'pending') <> 'ignored'
      and not coalesce(a.own_transfer, false)
      and coalesce(a.is_pix, coalesce(a.description, '') ilike '%pix%')
      and not exists (select 1 from public.open_finance_contas_proprias cp
                       where cp.user_id = a.user_id and a.description ilike '%' || cp.termo || '%')
  )
  select x.dia, sum(x.amount)::numeric, count(*)::int, max(x.transacted_at)
  from tx x
  where x.dia between p_de and p_ate
  group by x.dia;
$$;

-- ---------- 2) Pix do dia: só pra testers, e no dia da ÚLTIMA sessão ----------
create or replace function public.banco_pix_do_dia(p_dia date default null)
returns table(tem_banco boolean, banco text, total numeric, qtd integer, ultima_sync timestamptz, status text)
language sql stable security definer set search_path to 'public' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  d as (
    select coalesce(
      p_dia,
      (select max(cs.date) from public.challenge_sessions cs
        where cs.user_id = auth.uid() and cs.date >= (select d from hoje) - 1),
      (select d from hoje)) as dia
  ),
  b as (
    select institution_name, last_synced_at, status
    from public.bank_connections
    where user_id = auth.uid() and coalesce(status, '') <> 'deleted'
      and public.open_finance_teste(auth.uid())
    order by last_synced_at desc nulls last limit 1
  ),
  e as (select * from public.banco_pix_por_dia(auth.uid(), (select dia from d), (select dia from d)))
  select exists (select 1 from b),
         (select institution_name from b),
         case when exists (select 1 from b) then coalesce((select sum(e.total) from e), 0) else 0 end::numeric,
         case when exists (select 1 from b) then coalesce((select sum(e.qtd) from e), 0) else 0 end::int,
         (select last_synced_at from b),
         (select status from b);
$$;

-- ---------- 3) Ranking: o que o vendedor lançou, pra todo mundo ----------
create or replace function public.get_weekly_ranking_verified(p_week_start date, p_week_end date, p_usar_extrato boolean default true)
returns table (user_id uuid, nome_usuario text, avatar_url text, faturamento_semana numeric, dias_semana integer)
language sql security definer set search_path to 'public' as $$
  with ext as (
    select eu.user_id, eu.dia as d, sum(coalesce(eu.total_verificado, 0))::numeric as val
    from extrato_uploads eu
    where eu.dia >= p_week_start and eu.dia <= p_week_end
    group by eu.user_id, eu.dia
  ),
  -- RANKING MISTO DESLIGADO (03/10): CTE vazio, pra religar sem reescrever.
  bancos as (
    select bc.user_id,
           greatest(min((bc.created_at at time zone 'America/Sao_Paulo')::date), date '2026-10-02') as desde,
           bool_or(upper(coalesce(bc.status, '')) in ('UPDATED', 'UPDATING', 'LOGIN_IN_PROGRESS', 'CONNECTED')) as saudavel
    from bank_connections bc
    where false
    group by bc.user_id
  ),
  pixb as (
    select b.user_id, x.dia as d, x.total as val
    from bancos b
    cross join lateral public.banco_pix_por_dia(b.user_id, greatest(p_week_start, b.desde), p_week_end) x
    where greatest(p_week_start, b.desde) <= p_week_end
  ),
  declarado as (
    select ds.user_id, ds.date::date as d, sum(coalesce(ds.total_profit, 0))::numeric as val
    from daily_sales ds
    where ds.date::date >= p_week_start and ds.date::date <= p_week_end
    group by ds.user_id, ds.date::date
  ),
  live as (
    select p.user_id, p.d, p.val from pixb p
    union all
    select dc.user_id, dc.d, dc.val
    from declarado dc
    left join bancos b on b.user_id = dc.user_id
    where b.user_id is null
       or dc.d < b.desde
       or (not b.saudavel and not exists (select 1 from pixb p where p.user_id = dc.user_id and p.d = dc.d))
  ),
  live_dia as (select l.user_id, l.d, sum(l.val)::numeric as val from live l group by l.user_id, l.d),
  merged as (
    select coalesce(e.user_id, l.user_id) as user_id,
           case when p_usar_extrato then coalesce(e.val, 0) else coalesce(l.val, 0) end as val
    from ext e full outer join live_dia l on e.user_id = l.user_id and e.d = l.d
  ),
  agg as (
    select m.user_id, sum(m.val)::numeric as faturamento, count(*) filter (where m.val > 0)::integer as dias
    from merged m group by m.user_id
  )
  select a.user_id, coalesce(pp.nickname, ''), coalesce(pp.avatar_url, ''), a.faturamento, a.dias
  from agg a
  left join public_profiles pp on pp.user_id = a.user_id
  left join profiles pr        on pr.user_id = a.user_id
  where coalesce(pr.ranking_hidden, false) = false
    and coalesce(pr.ranking_oculto, false) = false
    and a.faturamento > 0
  order by a.faturamento desc;
$$;

-- ---------- 6) conserto dos dias 02/10 ----------
-- Thiago: total e dia = soma das 20 vendas lançadas (R$ 809,90)
update public.challenge_sessions set total_sold = 809.9
 where user_id = 'e6411700-b761-4774-aebc-956dc6d2df43' and date = '2026-10-02' and total_sold < 809.9;
update public.daily_sales set pix_sales = coalesce(pix_sales,0) + (809.9 - coalesce(total_profit,0)), total_profit = 809.9
 where user_id = 'e6411700-b761-4774-aebc-956dc6d2df43' and date = '2026-10-02' and coalesce(total_profit,0) < 809.9;
-- Mohamed: o dia volta pro que foi lançado no DEFCON (R$ 1.378). Ele acerta
-- dinheiro/cartão/Pix pelo app depois.
update public.daily_sales set pix_sales = 1378 - coalesce(cash_sales,0) - coalesce(card_sales,0), total_profit = 1378
 where user_id = 'e38b0499-abbc-439d-b592-c8cac4c83741' and date = '2026-10-02' and coalesce(total_profit,0) < 1378;

-- ---------- conferência (deve mostrar tudo certo) ----------
select 'thiago 02/10' as quem, total_sold from public.challenge_sessions where user_id='e6411700-b761-4774-aebc-956dc6d2df43' and date='2026-10-02'
union all select 'mohamed daily 02/10', total_profit from public.daily_sales where user_id='e38b0499-abbc-439d-b592-c8cac4c83741' and date='2026-10-02'
union all select 'mohamed pix banco 02/10 (sem conta própria)', total from public.banco_pix_por_dia('e38b0499-abbc-439d-b592-c8cac4c83741','2026-10-02','2026-10-02');

-- ---------- parte 2 (aplicada 02:43) ----------
-- Parte 2 (03/10): Pix importado sem hora exata (transacted_at vazio) caía no
-- dia do relógio em vez da janela do DEFCON. Agora usa a hora da leitura.
create or replace function public.banco_pix_por_dia(p_user uuid, p_de date, p_ate date)
returns table(dia date, total numeric, qtd integer, ultimo timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with sess as (
    select cs.date as d, min(cs.started_at) as ini
    from public.challenge_sessions cs
    where cs.user_id = p_user and cs.started_at is not null
      and cs.date between p_de - 3 and p_ate + 3
    group by cs.date
  ),
  tx as (
    select a.amount, coalesce(a.transacted_at, a.created_at) as quando,
           coalesce(
             (select s.d from sess s where s.ini <= coalesce(a.transacted_at, a.created_at) order by s.ini desc limit 1),
             (coalesce(a.transacted_at, a.created_at) at time zone 'America/Sao_Paulo')::date,
             a.transaction_date) as dia
    from public.auto_detected_sales a
    where a.user_id = p_user
      and a.transaction_date between p_de - 2 and p_ate + 2
      and coalesce(a.status, 'pending') <> 'ignored'
      and not coalesce(a.own_transfer, false)
      and coalesce(a.is_pix, coalesce(a.description, '') ilike '%pix%')
      and not exists (select 1 from public.open_finance_contas_proprias cp
                       where cp.user_id = a.user_id and a.description ilike '%' || cp.termo || '%')
  )
  select x.dia, sum(x.amount)::numeric, count(*)::int, max(x.quando)
  from tx x
  where x.dia between p_de and p_ate
  group by x.dia;
$$;
