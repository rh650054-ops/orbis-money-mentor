import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate, formatBrazilDate } from "@/shared/lib/date-utils";
import { extratoValendo } from "@/shared/lib/ranking-config";

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
  last_active_at?: string | null;
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

    // Ordena e publica o ranking na tela (faturamento + constancia + posicao do usuario).
    const applyAndSet = (entries: any[]) => {
      // Faturamento = só quem tem valor VERIFICADO > 0 (anti-fraude, igual ao semanal).
      const faturamentoSorted = [...entries]
        .filter((e) => (e.faturamento_total_mes || 0) > 0)
        .sort((a, b) => b.faturamento_total_mes - a.faturamento_total_mes);
      const constanciaSorted = [...entries].sort((a, b) => {
        if (b.dias_trabalhados_mes !== a.dias_trabalhados_mes) {
          return b.dias_trabalhados_mes - a.dias_trabalhados_mes;
        }
        return b.constancia_streak_atual - a.constancia_streak_atual;
      });
      setFaturamentoRanking(faturamentoSorted);
      setConstanciaRanking(constanciaSorted);
      if (userId) {
        const userStats = entries.find((e) => e.user_id === userId);
        if (userStats) {
          const fIdx = faturamentoSorted.findIndex((e) => e.user_id === userId);
          const cIdx = constanciaSorted.findIndex((e) => e.user_id === userId);
          setCurrentUserStats({
            ...userStats,
            posicao_faturamento: fIdx >= 0 ? fIdx + 1 : null,
            posicao_constancia: cIdx >= 0 ? cIdx + 1 : null,
          });
          setHasParticipated(true);
        }
      }
    };

    try {
      const { data: allEntries, error } = await supabase
        .from("leaderboard_stats")
        .select("id, user_id, nome_usuario, avatar_url, mes_referencia, faturamento_total_mes, dias_trabalhados_mes, constancia_maior_streak, constancia_streak_atual, posicao_faturamento, posicao_constancia")
        .eq("mes_referencia", currentMonth)
        .gt("dias_trabalhados_mes", 0)
        .order("faturamento_total_mes", { ascending: false })
        .limit(300);

      if (error) {
        console.error("Error loading leaderboard:", error);
        return;
      }

      const entries = (allEntries || []) as any[];

      // FATURAMENTO ANTI-FRAUDE: troca o valor do cache pelo VERIFICADO do extrato (mês),
      // reaproveitando a mesma RPC do semanal com o intervalo do mês. A constância continua
      // vindo do cache. Fase 1 (antes de 06/07) = ao vivo; Fase 2 = só extrato.
      try {
        const monthStart = `${currentMonth}-01`;
        const today = getBrazilDate();
        const usarExtrato = extratoValendo(today);
        const { data: ver } = await supabase.rpc("get_weekly_ranking_verified", {
          p_week_start: monthStart,
          p_week_end: today,
          p_usar_extrato: usarExtrato,
        });
        const vmap = new Map(((ver as any[]) || []).map((r: any) => [r.user_id, Number(r.faturamento_semana) || 0]));
        entries.forEach((e: any) => {
          e.faturamento_total_mes = vmap.get(e.user_id) ?? 0;
        });
      } catch {
        /* se a RPC falhar, mantém o valor do cache */
      }

      // 1) Abre JA com nome/foto do proprio leaderboard_stats — nao espera mais nada.
      applyAndSet(entries);

      // Usuario sem entrada na lista (0 dias): busca a linha dele a parte.
      if (userId && !entries.find((e) => e.user_id === userId)) {
        const { data: userEntry } = await supabase
          .from("leaderboard_stats")
          .select("id, user_id, nome_usuario, avatar_url, mes_referencia, faturamento_total_mes, dias_trabalhados_mes, constancia_maior_streak, constancia_streak_atual, posicao_faturamento, posicao_constancia")
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

      setIsLoading(false); // a tela ja pode aparecer aqui

      // 2) Enriquece com a foto/nome MAIS RECENTE (public_profiles) em SEGUNDO PLANO,
      // sem segurar a abertura. Quando voltar, re-publica com os dados frescos.
      const ids = entries.map((e) => e.user_id);
      if (ids.length > 0) {
        // Em paralelo: foto/nome mais recentes + presença online (última atividade no DEFCON).
        const [profsRes, presenceRes] = await Promise.all([
          supabase.from("public_profiles").select("user_id, nickname, avatar_url").in("user_id", ids),
          supabase.from("user_presence").select("user_id, last_active_at").in("user_id", ids),
        ]);
        let changed = false;
        const profs = profsRes.data;
        if (profs && profs.length > 0) {
          const profMap = new Map((profs as any[]).map((p) => [p.user_id, p]));
          entries.forEach((e: any) => {
            const p = profMap.get(e.user_id);
            if (p) {
              if (p.avatar_url) e.avatar_url = p.avatar_url;
              if (p.nickname) e.nome_usuario = p.nickname;
            }
          });
          changed = true;
        }
        const presence = presenceRes.data;
        if (presence && presence.length > 0) {
          const presMap = new Map((presence as any[]).map((p) => [p.user_id, p.last_active_at]));
          entries.forEach((e: any) => {
            e.last_active_at = presMap.get(e.user_id) ?? null;
          });
          changed = true;
        }
        if (changed) applyAndSet(entries);
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
    const yesterdayStr = formatBrazilDate(yesterday);

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

  // Subscribe to realtime updates (com throttle: vendas ao vivo no DEFCON geram muitos
  // eventos; recarrega no maximo a cada 8s pra nao virar tempestade de recarregamento).
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
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
          if (pending) return;
          pending = setTimeout(() => { pending = null; loadLeaderboard(); }, 8000);
        }
      )
      .subscribe();

    return () => {
      if (pending) clearTimeout(pending);
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
