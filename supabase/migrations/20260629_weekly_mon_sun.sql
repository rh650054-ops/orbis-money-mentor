-- ============================================================================
-- Liga Semanal: muda o ciclo de DOMINGO→SÁBADO para SEGUNDA→DOMINGO.
-- Encerra domingo 23:59 e zera na segunda. Agora recebe INÍCIO e FIM da janela
-- (pra 1ª semana do mês quebrado: 01/07 qua → 05/07 dom; depois é Seg→Dom puro).
--
-- Lê de daily_sales.total_profit (mesma fonte do mensal, atualizada em tempo real
-- pelo DEFCON). Respeita profiles.ranking_hidden. SECURITY DEFINER.
--
-- Como usar: cole TUDO no Supabase -> SQL Editor -> Run.
-- (Mantém a versão antiga de 1 argumento convivendo, pra não quebrar na transição.)
-- ============================================================================
create or replace function public.get_weekly_ranking(p_week_start date, p_week_end date)
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
    and ds.date::date <= p_week_end
    and coalesce(pr.ranking_hidden, false) = false
  group by ds.user_id, pp.nickname, pp.avatar_url
  having coalesce(sum(ds.total_profit), 0) > 0
  order by faturamento_semana desc;
$$;

grant execute on function public.get_weekly_ranking(date, date) to anon, authenticated;
