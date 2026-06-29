-- ============================================================================
-- get_weekly_ranking_verified v2 — parametro p_usar_extrato.
--   - FALSE (teste, antes do dia 1): IGNORA extratos, usa SO o DEFCON ao vivo
--     (card+pix). Assim extrato de teste nao sobrescreve a venda real.
--   - TRUE (do dia 1 em diante): extrato SUBSTITUI o ao vivo (regra do desafio).
-- Dinheiro vivo nunca entra. Respeita ranking_hidden. SECURITY DEFINER.
--
-- Como usar: cole TUDO no Supabase -> SQL Editor -> Run.
-- ============================================================================
drop function if exists public.get_weekly_ranking_verified(date, date);

create or replace function public.get_weekly_ranking_verified(
  p_week_start date,
  p_week_end date,
  p_usar_extrato boolean default true
)
returns table (
  user_id            uuid,
  nome_usuario       text,
  avatar_url         text,
  faturamento_semana numeric,
  dias_semana        integer
)
language sql
security definer
set search_path = public
as $$
  with ext as (
    select eu.user_id, eu.dia as d, sum(coalesce(eu.total_verificado, 0))::numeric as val
    from extrato_uploads eu
    where eu.dia >= p_week_start and eu.dia <= p_week_end
    group by eu.user_id, eu.dia
  ),
  live as (
    select ds.user_id, ds.date::date as d,
           sum(coalesce(ds.card_sales, 0) + coalesce(ds.pix_sales, 0))::numeric as val
    from daily_sales ds
    where ds.date::date >= p_week_start and ds.date::date <= p_week_end
    group by ds.user_id, ds.date::date
  ),
  merged as (
    select
      coalesce(e.user_id, l.user_id) as user_id,
      case when p_usar_extrato and e.user_id is not null then e.val else coalesce(l.val, 0) end as val
    from ext e
    full outer join live l on e.user_id = l.user_id and e.d = l.d
  ),
  agg as (
    select m.user_id,
           sum(m.val)::numeric as faturamento,
           count(*) filter (where m.val > 0)::integer as dias
    from merged m
    group by m.user_id
  )
  select
    a.user_id,
    coalesce(pp.nickname, '')   as nome_usuario,
    coalesce(pp.avatar_url, '') as avatar_url,
    a.faturamento              as faturamento_semana,
    a.dias                     as dias_semana
  from agg a
  left join public_profiles pp on pp.user_id = a.user_id
  left join profiles pr        on pr.user_id = a.user_id
  where coalesce(pr.ranking_hidden, false) = false
    and a.faturamento > 0
  order by a.faturamento desc;
$$;

grant execute on function public.get_weekly_ranking_verified(date, date, boolean) to anon, authenticated;
