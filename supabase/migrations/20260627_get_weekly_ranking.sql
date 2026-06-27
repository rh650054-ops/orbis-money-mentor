-- ============================================================================
-- Ranking SEMANAL do Orbis (semana de DOMINGO a SÁBADO; zera entrando no domingo).
--
-- Lê de daily_sales.total_profit — a MESMA fonte do ranking mensal, que é
-- atualizada EM TEMPO REAL a cada venda (inclusive no DEFCON, via syncDailySales).
-- Assim a venda entra na Liga Semanal ASSIM QUE é registrada no DEFCON, sem
-- precisar finalizar a sessão.
--
-- Respeita profiles.ranking_hidden (igual o mensal). SECURITY DEFINER pra agregar
-- por cima do RLS (o faturamento no ranking já é público).
--
-- Como usar: cole TUDO no Supabase -> SQL Editor -> Run (substitui a versão antiga).
-- ============================================================================
create or replace function public.get_weekly_ranking(p_week_start date)
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
  select
    ds.user_id,
    coalesce(pp.nickname, '')                                          as nome_usuario,
    coalesce(pp.avatar_url, '')                                        as avatar_url,
    coalesce(sum(ds.total_profit), 0)::numeric                         as faturamento_semana,
    count(*) filter (where coalesce(ds.total_profit, 0) > 0)::integer  as dias_semana
  from daily_sales ds
  left join public_profiles pp on pp.user_id = ds.user_id
  left join profiles pr        on pr.user_id = ds.user_id
  where ds.date::date >= p_week_start
    and ds.date::date <  (p_week_start + 7)
    and coalesce(pr.ranking_hidden, false) = false
  group by ds.user_id, pp.nickname, pp.avatar_url
  having coalesce(sum(ds.total_profit), 0) > 0
  order by faturamento_semana desc;
$$;

grant execute on function public.get_weekly_ranking(date) to anon, authenticated;
