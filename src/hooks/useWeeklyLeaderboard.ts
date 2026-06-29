import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { LeaderboardEntry } from "@/hooks/useLeaderboard";

// A 1ª temporada começa no dia 1 (julho começou quebrado, numa quarta). Depois disso
// a semana é sempre SEGUNDA → DOMINGO: encerra domingo 23:59 e zera na segunda.
const TEMPORADA_INICIO = "2026-07-01";

// Início da janela do ranking (fuso BR).
// - ATÉ 30/06 (teste pré-lançamento): janela = ONTEM + HOJE, pra mostrar as vendas
//   recentes da galera sem exigir extrato (só o DEFCON ao vivo).
// - A PARTIR DE 01/07: semana SEGUNDA→DOMINGO, com a 1ª semana travada em 01–05/07.
export function currentWeekStart(): string {
  const todayISO = getBrazilDate(); // "YYYY-MM-DD" no fuso BR
  if (todayISO < TEMPORADA_INICIO) {
    const y = new Date(`${todayISO}T12:00:00Z`);
    y.setUTCDate(y.getUTCDate() - 1);
    return y.toISOString().slice(0, 10); // ontem
  }
  const d = new Date(`${todayISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // volta pra segunda (0 = domingo)
  const monday = d.toISOString().slice(0, 10);
  if (monday < TEMPORADA_INICIO) return TEMPORADA_INICIO;
  return monday;
}

// Fim da janela do ranking (fuso BR).
// - ATÉ 30/06: termina HOJE (teste com ontem + hoje).
// - A PARTIR DE 01/07: domingo da semana.
export function currentWeekEnd(): string {
  const todayISO = getBrazilDate();
  if (todayISO < TEMPORADA_INICIO) return todayISO;
  const d = new Date(`${todayISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 6); // segunda + 6 = domingo
  return d.toISOString().slice(0, 10);
}

// Lê o ranking da semana via RPC get_weekly_ranking e devolve no mesmo formato do
// ranking mensal (pra reaproveitar os componentes de pódio/lista).
export function useWeeklyLeaderboard(userId: string | undefined, enabled: boolean) {
  const [ranking, setRanking] = useState<LeaderboardEntry[]>([]);
  const [currentUserStats, setCurrentUserStats] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasParticipated, setHasParticipated] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const weekStart = currentWeekStart();
      const weekEnd = currentWeekEnd();
      // Antes do dia 1 (teste): IGNORA extrato, usa só o DEFCON ao vivo. Do dia 1: extrato vale.
      const usarExtrato = getBrazilDate() >= "2026-07-01";
      const { data, error } = await supabase.rpc("get_weekly_ranking_verified", { p_week_start: weekStart, p_week_end: weekEnd, p_usar_extrato: usarExtrato });
      if (error) {
        console.error("Ranking semanal erro:", error.message);
        setRanking([]);
        setCurrentUserStats(null);
        setHasParticipated(false);
        return;
      }
      const rows = (data as Record<string, unknown>[]) || [];
      const mapped: LeaderboardEntry[] = rows.map((r, i) => ({
        id: String(r.user_id),
        user_id: String(r.user_id),
        nome_usuario: (r.nome_usuario as string) || null,
        avatar_url: (r.avatar_url as string) || null,
        mes_referencia: weekStart,
        faturamento_total_mes: Number(r.faturamento_semana) || 0,
        dias_trabalhados_mes: Number(r.dias_semana) || 0,
        constancia_maior_streak: 0,
        constancia_streak_atual: 0,
        posicao_faturamento: i + 1,
        posicao_constancia: null,
      }));
      // Presença (bolinha online): puxa o last_active_at de user_presence — igual o Mensal.
      const ids = mapped.map((e) => e.user_id);
      if (ids.length > 0) {
        const { data: presence } = await supabase
          .from("user_presence")
          .select("user_id, last_active_at")
          .in("user_id", ids);
        const presMap = new Map(
          ((presence as { user_id: string; last_active_at: string }[]) || []).map((p) => [p.user_id, p.last_active_at]),
        );
        for (const e of mapped) e.last_active_at = presMap.get(e.user_id) ?? null;
      }
      setRanking(mapped);
      if (userId) {
        const me = mapped.find((e) => e.user_id === userId) || null;
        setCurrentUserStats(me);
        setHasParticipated(!!me);
      }
    } catch (e) {
      console.error("Ranking semanal exceção:", e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [userId]);

  // Carrega ao abrir a aba Semanal. Enquanto aberta, atualiza SOZINHO a cada 5s
  // (e ao voltar o foco) — pra refletir as vendas novas da galera ao vivo.
  useEffect(() => {
    if (!enabled) return;
    load();
    const id = setInterval(() => load(true), 5000);
    const onFocus = () => load(true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, load]);

  return { ranking, currentUserStats, isLoading, hasParticipated, reload: load };
}
