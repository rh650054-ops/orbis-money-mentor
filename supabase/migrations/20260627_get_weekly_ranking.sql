-- ============================================================================
-- Ranking SEMANAL do Orbis (semana de DOMINGO a SÁBADO; zera entrando no domingo).
-- Soma as vendas finalizadas da semana entre TODOS os vendedores.
-- SECURITY DEFINER: agrega por cima do RLS de work_sessions (igual o ranking mensal,
-- o faturamento no ranking já é público).
-- Como usar: cole tudo no Supabase -> SQL Editor -> Run.
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
    ws.user_id,
    coalesce(p.nickname, '')                     as nome_usuario,
    coalesce(p.avatar_url, '')                   as avatar_url,
    coalesce(sum(ws.total_vendido), 0)::numeric  as faturamento_semana,
    count(*)::integer                            as dias_semana
  from work_sessions ws
  left join public_profiles p on p.user_id = ws.user_id
  where ws.status = 'finished'
    and ws.planning_date::date >= p_week_start
    and ws.planning_date::date <  (p_week_start + 7)
  group by ws.user_id, p.nickname, p.avatar_url
  having coalesce(sum(ws.total_vendido), 0) > 0
  order by faturamento_semana desc;
$$;

grant execute on function public.get_weekly_ranking(date) to anon, authenticated;
