-- Orbis — desempate estavel no ranking mensal.
-- Antes: ROW_NUMBER() OVER (ORDER BY faturamento_total_mes DESC) sem criterio de desempate.
-- Em empate de faturamento, a posicao era arbitraria e OSCILAVA a cada recalculo (o card
-- "Voce #N" piscava). Adiciona `id` como desempate deterministico.
--
-- Cole TUDO no Supabase -> SQL Editor -> Run.

CREATE OR REPLACE FUNCTION public.recalculate_ranking_positions(target_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update faturamento positions (desempate por id = estavel)
  WITH ranked_faturamento AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY faturamento_total_mes DESC, id) as pos
    FROM public.leaderboard_stats
    WHERE mes_referencia = target_month AND dias_trabalhados_mes > 0
  )
  UPDATE public.leaderboard_stats ls
  SET posicao_faturamento = rf.pos
  FROM ranked_faturamento rf
  WHERE ls.id = rf.id;

  -- Update constancia positions (desempate por id = estavel)
  WITH ranked_constancia AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY dias_trabalhados_mes DESC, constancia_streak_atual DESC, id) as pos
    FROM public.leaderboard_stats
    WHERE mes_referencia = target_month AND dias_trabalhados_mes > 0
  )
  UPDATE public.leaderboard_stats ls
  SET posicao_constancia = rc.pos
  FROM ranked_constancia rc
  WHERE ls.id = rc.id;
END;
$$;
