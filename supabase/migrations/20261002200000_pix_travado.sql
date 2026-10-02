-- ============================================================
-- PIX TRAVADO (etapa 1 do Open Finance) — 02/10/2026
--   • auto_detected_sales ganha o que faltava pra separar Pix de verdade:
--       is_pix        → a Pluggy disse que é Pix (paymentData/operationType)
--       transacted_at → data+hora real do crédito (o dia do ranking é o dia
--                       em Brasília, não o dia UTC — Pix das 21h caía amanhã)
--       own_transfer  → quem pagou tem o mesmo CPF do vendedor (transferência
--                       entre contas dele mesmo não é venda)
--   • banco_pix_por_dia(user, de, ate): a régua única do "Pix pelo banco".
--     Uso interno (ranking e banco_pix_do_dia); ninguém de fora chama.
--   • banco_pix_do_dia: mesma assinatura, agora usando a régua nova.
--   • get_weekly_ranking_verified: RANKING MISTO (decisão do Rick, 02/10):
--       quem tem banco ligado → no dia conta SÓ o Pix do banco (travado);
--       quem não tem          → continua como antes (o que lançou no dia).
--     Vale a partir de 02/10/2026 e do dia em que o banco foi ligado. Se o
--     banco cair (status de erro) e não houver Pix lido no dia, o dia volta
--     a usar o lançado, pra ninguém zerar por falha de conexão.
-- ============================================================

alter table public.auto_detected_sales
  add column if not exists is_pix boolean,
  add column if not exists transacted_at timestamptz,
  add column if not exists own_transfer boolean not null default false;

create index if not exists auto_detected_sales_user_dia_idx
  on public.auto_detected_sales (user_id, transaction_date);

-- ---------- régua única do Pix pelo banco ----------
create or replace function public.banco_pix_por_dia(p_user uuid, p_de date, p_ate date)
returns table (dia date, total numeric, qtd integer, ultimo timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select x.dia, sum(x.amount)::numeric, count(*)::int, max(x.transacted_at)
  from (
    select a.amount, a.transacted_at,
           coalesce((a.transacted_at at time zone 'America/Sao_Paulo')::date, a.transaction_date) as dia
    from public.auto_detected_sales a
    where a.user_id = p_user
      and a.transaction_date between p_de - 1 and p_ate + 1
      and coalesce(a.status, 'pending') <> 'ignored'
      and not coalesce(a.own_transfer, false)
      and coalesce(a.is_pix, coalesce(a.description, '') ilike '%pix%')
  ) x
  where x.dia between p_de and p_ate
  group by x.dia;
$$;
revoke all on function public.banco_pix_por_dia(uuid, date, date) from public, anon, authenticated;

-- ---------- o que caiu hoje (DEFCON e relatório) ----------
create or replace function public.banco_pix_do_dia(p_dia date default null)
returns table (tem_banco boolean, banco text, total numeric, qtd integer, ultima_sync timestamptz, status text)
language sql stable security definer set search_path to 'public' as $$
  with d as (select coalesce(p_dia, (now() at time zone 'America/Sao_Paulo')::date) as dia),
  b as (
    select institution_name, last_synced_at, status
    from public.bank_connections
    where user_id = auth.uid() and coalesce(status, '') <> 'deleted'
    order by last_synced_at desc nulls last limit 1
  ),
  e as (select * from public.banco_pix_por_dia(auth.uid(), (select dia from d), (select dia from d)))
  select exists (select 1 from b),
         (select institution_name from b),
         coalesce((select sum(e.total) from e), 0)::numeric,
         coalesce((select sum(e.qtd) from e), 0)::int,
         (select last_synced_at from b),
         (select status from b);
$$;
revoke all on function public.banco_pix_do_dia(date) from public, anon;
grant execute on function public.banco_pix_do_dia(date) to authenticated;

-- ---------- ranking misto ----------
create or replace function public.get_weekly_ranking_verified(p_week_start date, p_week_end date, p_usar_extrato boolean default true)
returns table (user_id uuid, nome_usuario text, avatar_url text, faturamento_semana numeric, dias_semana integer)
language sql security definer set search_path to 'public' as $$
  with ext as (
    select eu.user_id, eu.dia as d, sum(coalesce(eu.total_verificado, 0))::numeric as val
    from extrato_uploads eu
    where eu.dia >= p_week_start and eu.dia <= p_week_end
    group by eu.user_id, eu.dia
  ),
  -- quem tem banco: desde quando o Pix do banco manda (nunca antes de 02/10/2026)
  bancos as (
    select bc.user_id,
           greatest(min((bc.created_at at time zone 'America/Sao_Paulo')::date), date '2026-10-02') as desde,
           bool_or(upper(coalesce(bc.status, '')) in ('UPDATED', 'UPDATING', 'LOGIN_IN_PROGRESS', 'CONNECTED')) as saudavel
    from bank_connections bc
    where coalesce(bc.status, '') <> 'deleted'
    group by bc.user_id
  ),
  pixb as (
    select b.user_id, x.dia as d, x.total as val
    from bancos b
    cross join lateral public.banco_pix_por_dia(b.user_id, greatest(p_week_start, b.desde), p_week_end) x
    where greatest(p_week_start, b.desde) <= p_week_end
  ),
  declarado as (
    select ds.user_id, ds.date::date as d,
           sum(coalesce(ds.total_profit, 0))::numeric as val   -- valor CHEIO: cartão+pix+dinheiro
    from daily_sales ds
    where ds.date::date >= p_week_start and ds.date::date <= p_week_end
    group by ds.user_id, ds.date::date
  ),
  -- dia "pelo banco": tem banco, já valia nesse dia, e (leu Pix nesse dia OU o banco está saudável)
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
  live_dia as (
    select l.user_id, l.d, sum(l.val)::numeric as val from live l group by l.user_id, l.d
  ),
  merged as (
    select
      coalesce(e.user_id, l.user_id) as user_id,
      case when p_usar_extrato then coalesce(e.val, 0) else coalesce(l.val, 0) end as val
    from ext e
    full outer join live_dia l on e.user_id = l.user_id and e.d = l.d
  ),
  agg as (
    select m.user_id, sum(m.val)::numeric as faturamento, count(*) filter (where m.val > 0)::integer as dias
    from merged m
    group by m.user_id
  )
  select a.user_id,
         coalesce(pp.nickname, '')   as nome_usuario,
         coalesce(pp.avatar_url, '') as avatar_url,
         a.faturamento               as faturamento_semana,
         a.dias                      as dias_semana
  from agg a
  left join public_profiles pp on pp.user_id = a.user_id
  left join profiles pr        on pr.user_id = a.user_id
  where coalesce(pr.ranking_hidden, false) = false
    and coalesce(pr.ranking_oculto, false) = false
    and a.faturamento > 0
  order by a.faturamento desc;
$$;
