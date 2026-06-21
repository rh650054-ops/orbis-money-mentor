-- ============================================================================
-- Item 8 — Ranking: as POSICOES pararam de recalcular
-- ----------------------------------------------------------------------------
-- A migration 20260617140637 (passada de seguranca) REVOGOU o EXECUTE de
-- recalculate_ranking_positions(text) e recalculate_competition_scores(uuid)
-- do papel 'authenticated'. Mas quem chama essas RPCs e' o CLIENTE
-- (src/hooks/useLeaderboard.ts e src/utils/syncDailySales.ts). Resultado: as
-- chamadas falhavam calado e o campo posicao_faturamento ficou congelado/NULL
-- -> patente e posicao erradas no card "VOCE #N", no duelo (RankingChase) e nas
-- animacoes de liga.
--
-- As duas funcoes sao SECURITY DEFINER e so mexem em leaderboard_stats /
-- competition_participants (recalculo idempotente a partir do que ja existe —
-- ninguem infla a propria posicao). Seguro re-liberar.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.recalculate_ranking_positions(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_competition_scores(uuid) TO authenticated;

-- Verificacao (opcional): deve listar as duas com 'authenticated' nos grants.
-- SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS pode_executar
-- FROM pg_proc p
-- WHERE p.proname IN ('recalculate_ranking_positions','recalculate_competition_scores');
