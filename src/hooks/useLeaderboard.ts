import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  nome_usuario: string | null;
  avatar_url: string | null;
  mes_referencia: string;
  faturamento_total_mes: number;
  dias_trabalhados_mes: number;
  constancia_maior_streak: number;
  constancia_streak_atual: number;
  posicao_faturamento: number | null;
  posicao_constancia: number | null;
}

export function useLeaderboard(userId: string | undefined) {
  const [faturamentoRanking, setFaturamentoRanking] = useState<LeaderboardEntry[]>([]);
  const [constanciaRanking, setConstanciaRanking] = useState<LeaderboardEntry[]>([]);
  const [currentUserStats, setCurrentUserStats] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasParticipated, setHasParticipated] = useState(false);

  const getCurrentMonth = () => {
    // Usa timezone Brasil para garantir mês correto
    return getBrazilDate().substring(0, 7);
  };

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    const currentMonth = getCurrentMonth();

    try {
      // Load all entries for current month with dias_trabalhados > 0
      const { data: allEntries, error } = await supabase
        .from("leaderboard_stats")
        .select("*")
        .eq("mes_referencia", currentMonth)
        .gt("dias_trabalhados_mes", 0)
        .order("faturamento_total_mes", { ascending: false });

      if (error) {
        console.error("Error loading leaderboard:", error);
        return;
      }

      // Sort by faturamento for that ranking
      const faturamentoSorted = [...(allEntries || [])].sort(
        (a, b) => b.faturamento_total_mes - a.faturamento_total_mes
      );

      // Sort by dias_trabalhados for constancia ranking
      const constanciaSorted = [...(allEntries || [])].sort(
        (a, b) => {
          if (b.dias_trabalhados_mes !== a.dias_trabalhados_mes) {
            return b.dias_trabalhados_mes - a.dias_trabalhados_mes;
          }
          return b.constancia_streak_atual - a.constancia_streak_atual;
        }
      );

      setFaturamentoRanking(faturamentoSorted);
      setConstanciaRanking(constanciaSorted);

      // Find current user stats
      if (userId) {
        const userStats = allEntries?.find(e => e.user_id === userId);
        if (userStats) {
          // Calculate positions
          const faturamentoPos = faturamentoSorted.findIndex(e => e.user_id === userId) + 1;
          const constanciaPos = constanciaSorted.findIndex(e => e.user_id === userId) + 1;
          
          setCurrentUserStats({
            ...userStats,
            posicao_faturamento: faturamentoPos,
            posicao_constancia: constanciaPos
          });
          setHasParticipated(true);
        } else {
          // Check if user has any entry (even with 0 days)
          const { data: userEntry } = await supabase
            .from("leaderboard_stats")
            .select("*")
            .eq("user_id", userId)
            .eq("mes_referencia", currentMonth)
            .maybeSingle();

          if (userEntry) {
            setCurrentUserStats(userEntry);
            setHasParticipated(userEntry.dias_trabalhados_mes > 0);
          } else {
            setCurrentUserStats(null);
            setHasParticipated(false);
          }
        }
      }
    } catch (err) {
      console.error("Error in loadLeaderboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Update leaderboard stats when user finishes a day
  const updateUserStats = async (
    totalVendidoHoje: number,
    workedYesterday: boolean
  ) => {
    if (!userId) return;

    const currentMonth = getCurrentMonth();
    const today = getBrazilDate();

    try {
      // Get user profile for name and avatar
      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname, email, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

      const userName = profile?.nickname || profile?.email?.split('@')[0] || 'Usuário';
      const avatarUrl = profile?.avatar_url;

      // Get or create leaderboard entry
      const { data: existingEntry } = await supabase
        .from("leaderboard_stats")
        .select("*")
        .eq("user_id", userId)
        .eq("mes_referencia", currentMonth)
        .maybeSingle();

      // Check if today was already counted
      const { data: todayWork } = await supabase
        .from("work_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("planning_date", today)
        .eq("status", "finished")
        .maybeSingle();

      // Count total days worked this month
      const startOfMonth = `${currentMonth}-01`;
      const { count: daysWorkedCount } = await supabase
        .from("work_sessions")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId)
        .eq("status", "finished")
        .gte("planning_date", startOfMonth)
        .lte("planning_date", today);

      // Calculate total revenue this month
      const { data: monthSessions } = await supabase
        .from("work_sessions")
        .select("total_vendido")
        .eq("user_id", userId)
        .eq("status", "finished")
        .gte("planning_date", startOfMonth)
        .lte("planning_date", today);

      const totalFaturamento = monthSessions?.reduce(
        (sum, s) => sum + (s.total_vendido || 0), 0
      ) || 0;

      const diasTrabalhados = daysWorkedCount || 0;

      // Calculate streak
      let currentStreak = existingEntry?.constancia_streak_atual || 0;
      let maxStreak = existingEntry?.constancia_maior_streak || 0;

      if (workedYesterday) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }

      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }

      if (existingEntry) {
        // Update existing entry
        await supabase
          .from("leaderboard_stats")
          .update({
            nome_usuario: userName,
            avatar_url: avatarUrl,
            faturamento_total_mes: totalFaturamento,
            dias_trabalhados_mes: diasTrabalhados,
            constancia_streak_atual: currentStreak,
            constancia_maior_streak: maxStreak,
          })
          .eq("id", existingEntry.id);
      } else {
        // Create new entry
        await supabase
          .from("leaderboard_stats")
          .insert({
            user_id: userId,
            nome_usuario: userName,
            avatar_url: avatarUrl,
            mes_referencia: currentMonth,
            faturamento_total_mes: totalFaturamento,
            dias_trabalhados_mes: diasTrabalhados,
            constancia_streak_atual: currentStreak,
            constancia_maior_streak: maxStreak,
          });
      }

      // Recalculate positions for all users
      await supabase.rpc('recalculate_ranking_positions', { target_month: currentMonth });

      // Reload leaderboard
      await loadLeaderboard();
    } catch (err) {
      console.error("Error updating user stats:", err);
    }
  };

  // Check if user worked yesterday
  const checkWorkedYesterday = async (): Promise<boolean> => {
    if (!userId) return false;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data } = await supabase
      .from("work_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("planning_date", yesterdayStr)
      .eq("status", "finished")
      .maybeSingle();

    return !!data;
  };

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leaderboard_stats'
        },
        () => {
          loadLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLeaderboard]);

  return {
    faturamentoRanking,
    constanciaRanking,
    currentUserStats,
    isLoading,
    hasParticipated,
    updateUserStats,
    checkWorkedYesterday,
    loadLeaderboard,
    getCurrentMonth,
  };
}
