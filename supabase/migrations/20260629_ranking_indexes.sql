-- Orbis — indices pra acelerar o ranking (estava fazendo varredura completa).
-- A query do ranking MENSAL filtra por mes_referencia e ordena por faturamento_total_mes,
-- mas so existia PK(id) e UNIQUE(user_id, mes_referencia) — nenhum util pra esse filtro.
-- Com esse indice a query vira um index scan ordenado (rapido), em vez de scan + sort.

CREATE INDEX IF NOT EXISTS idx_leaderboard_stats_mes_fat
  ON public.leaderboard_stats (mes_referencia, faturamento_total_mes DESC);

-- daily_sales: usado pelo ranking SEMANAL (get_weekly_ranking) e pela pontuacao da
-- competicao (filtram por data). Indice por data acelera os dois.
CREATE INDEX IF NOT EXISTS idx_daily_sales_date
  ON public.daily_sales (date);
