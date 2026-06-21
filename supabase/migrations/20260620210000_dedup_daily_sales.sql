-- ============================================================================
-- Item 10 — daily_sales duplicado (4 dias, 5 linhas extras)
-- ----------------------------------------------------------------------------
-- A constraint UNIQUE(user_id, date) foi removida em migracoes antigas, entao
-- writers diferentes (DEFCON, formulario, banco/Open Finance) criaram mais de
-- uma linha por dia. O syncLeaderboardRevenue SOMA todas -> inflava o
-- faturamento no ranking.
--
-- Estrategia de consolidacao (segura): por (user_id, date), soma as linhas
-- DISTINTAS de valor. Assim:
--   - duplicata EXATA (ex.: dois R$12 iguais = mesma venda 2x) -> conta 1 vez;
--   - vendas DIFERENTES de fontes distintas -> somam (additivo, correto);
--   - linhas zeradas -> somam 0 (nao atrapalham).
-- Mantem a linha mais antiga de cada grupo e apaga as outras.
--
-- Roda dentro de um bloco DO (uma chamada atomica) -> sem tabelas temporarias,
-- compativel com o SQL Editor do Supabase (que faz autocommit por statement).
-- ============================================================================

DO $$
BEGIN
  -- 1. Consolida: soma as linhas DISTINTAS na linha mais antiga de cada grupo.
  WITH dups AS (
    SELECT user_id, date
    FROM public.daily_sales
    GROUP BY user_id, date
    HAVING count(*) > 1
  ),
  keep AS (
    SELECT DISTINCT ON (user_id, date) id, user_id, date
    FROM public.daily_sales
    WHERE (user_id, date) IN (SELECT user_id, date FROM dups)
    ORDER BY user_id, date, created_at ASC, id ASC
  ),
  consol AS (
    SELECT user_id, date,
           sum(total_profit) AS total_profit,
           sum(total_debt)   AS total_debt,
           sum(cash_sales)   AS cash_sales,
           sum(card_sales)   AS card_sales,
           sum(pix_sales)    AS pix_sales,
           sum(tip_sales)    AS tip_sales
    FROM (
      SELECT DISTINCT user_id, date, total_profit, total_debt,
             cash_sales, card_sales, pix_sales, COALESCE(tip_sales, 0) AS tip_sales
      FROM public.daily_sales
      WHERE (user_id, date) IN (SELECT user_id, date FROM dups)
    ) dv
    GROUP BY user_id, date
  )
  UPDATE public.daily_sales d
  SET total_profit = c.total_profit,
      total_debt   = c.total_debt,
      cash_sales   = c.cash_sales,
      card_sales   = c.card_sales,
      pix_sales    = c.pix_sales,
      tip_sales    = c.tip_sales,
      unpaid_sales = CASE WHEN c.total_debt > 0 THEN 1 ELSE 0 END
  FROM keep k
  JOIN consol c ON c.user_id = k.user_id AND c.date = k.date
  WHERE d.id = k.id;

  -- 2. Apaga as linhas duplicadas (mantem so a mais antiga de cada grupo).
  WITH dups AS (
    SELECT user_id, date
    FROM public.daily_sales
    GROUP BY user_id, date
    HAVING count(*) > 1
  ),
  keep AS (
    SELECT DISTINCT ON (user_id, date) id
    FROM public.daily_sales
    WHERE (user_id, date) IN (SELECT user_id, date FROM dups)
    ORDER BY user_id, date, created_at ASC, id ASC
  )
  DELETE FROM public.daily_sales d
  WHERE (d.user_id, d.date) IN (SELECT user_id, date FROM dups)
    AND d.id NOT IN (SELECT id FROM keep);
END $$;

-- Blinda o futuro: 1 linha por (user_id, date).
CREATE UNIQUE INDEX IF NOT EXISTS daily_sales_user_date_unique
  ON public.daily_sales (user_id, date);
