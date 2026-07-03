-- ============================================================
-- ORBIS — DEPLOY DAS MIGRATIONS (cole TUDO no Supabase -> SQL Editor -> Run)
-- Projeto: Orbis Milion (qbcsjsdwjjpybvzbxszi)
-- Seguro rodar de uma vez (tudo idempotente). Ordem ja correta.
-- ============================================================

-- 1) IDEMPOTENCIA DO WEBHOOK HOTMART (nao ativar assinatura 2x / nao ressuscitar cancelada)
create table if not exists public.processed_hotmart_events (
  event_id     text primary key,
  event_type   text,
  purchase_id  text,
  processed_at timestamptz not null default now()
);
alter table public.processed_hotmart_events enable row level security;
-- Sem policies de proposito: RLS ligado + nenhuma policy = so o service_role acessa.

-- 2) TRAVA ANTI-FRAUDE NO EXTRATO (usuario nao grava total_verificado direto)
drop policy if exists "extrato_insert_own" on public.extrato_uploads;
drop policy if exists "extrato_update_own" on public.extrato_uploads;
-- Mantidas: extrato_select_own (ler) e extrato_delete_own (apagar o proprio).

-- 3) DESEMPATE ESTAVEL NO RANKING (posicao para de piscar em empate)
CREATE OR REPLACE FUNCTION public.recalculate_ranking_positions(target_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ranked_faturamento AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY faturamento_total_mes DESC, id) as pos
    FROM public.leaderboard_stats
    WHERE mes_referencia = target_month AND dias_trabalhados_mes > 0
  )
  UPDATE public.leaderboard_stats ls
  SET posicao_faturamento = rf.pos
  FROM ranked_faturamento rf
  WHERE ls.id = rf.id;

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

-- ============================================================
-- FIM. Se rodou sem erro vermelho, as 3 correcoes estao no ar.
-- ============================================================
