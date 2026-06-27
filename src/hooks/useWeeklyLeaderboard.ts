import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { LeaderboardEntry } from "@/hooks/useLeaderboard";

// Domingo desta semana (00h) no fuso do Brasil. A semana conta de domingo a sábado;
// quando vira o domingo, o week_start muda e o ranking "zera" sozinho.
export function currentWeekStart(): string {
  const todayISO = getBrazilDate(); // "YYYY-MM-DD" no fuso BR
  const d = new Date(`${todayISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // getUTCDay: 0 = domingo
  return d.toISOString().slice(0, 10);
}

// Lê o ranking da semana via RPC get_weekly_ranking e devolve no mesmo formato do
// ranking mensal (pra reaproveitar os componentes de pódio/lista).
export function useWeeklyLeaderboard(userId: string | undefined) {
  const [ranking, setRanking] = useState<LeaderboardEntry[]>([]);
  const [currentUserStats, setCurrentUserStats] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasParticipated, setHasParticipated] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const weekStart = currentWeekStart();
      const { data, error } = await supabase.rpc("get_weekly_ranking", { p_week_start: weekStart });
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
      setRanking(mapped);
      if (userId) {
        const me = mapped.find((e) => e.user_id === userId) || null;
        setCurrentUserStats(me);
        setHasParticipated(!!me);
      }
    } catch (e) {
      console.error("Ranking semanal exceção:", e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  return { ranking, currentUserStats, isLoading, hasParticipated, reload: load };
}
