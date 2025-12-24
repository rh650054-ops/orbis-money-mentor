import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";

export interface DashboardTodayStats {
  faturamentoBruto: number;
  totalCalotes: number;
  faturamentoLiquido: number;
  totalDinheiro: number;
  totalCartao: number;
  totalPix: number;
}

/**
 * Hook that provides real-time dashboard stats synced from hourly blocks
 * This is the SOURCE OF TRUTH for today's revenue from the Ritmo page
 */
export function useDashboardSync(userId: string | undefined) {
  const [todayStats, setTodayStats] = useState<DashboardTodayStats>({
    faturamentoBruto: 0,
    totalCalotes: 0,
    faturamentoLiquido: 0,
    totalDinheiro: 0,
    totalCartao: 0,
    totalPix: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadTodayStats = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const today = getBrazilDate();

    // Get plan for today
    const { data: planData } = await supabase
      .from("daily_goal_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (!planData) {
      setTodayStats({
        faturamentoBruto: 0,
        totalCalotes: 0,
        faturamentoLiquido: 0,
        totalDinheiro: 0,
        totalCartao: 0,
        totalPix: 0,
      });
      setLoading(false);
      return;
    }

    // Get all blocks for today's plan
    const { data: blocksData } = await supabase
      .from("hourly_goal_blocks")
      .select("valor_dinheiro, valor_cartao, valor_pix, valor_calote")
      .eq("plan_id", planData.id);

    if (blocksData) {
      const totalDinheiro = blocksData.reduce((sum, b) => sum + (b.valor_dinheiro || 0), 0);
      const totalCartao = blocksData.reduce((sum, b) => sum + (b.valor_cartao || 0), 0);
      const totalPix = blocksData.reduce((sum, b) => sum + (b.valor_pix || 0), 0);
      const totalCalotes = blocksData.reduce((sum, b) => sum + (b.valor_calote || 0), 0);

      // Bruto = dinheiro + cartao + pix + calote
      const faturamentoBruto = totalDinheiro + totalCartao + totalPix + totalCalotes;
      // Liquido = dinheiro + cartao + pix (sem calotes)
      const faturamentoLiquido = totalDinheiro + totalCartao + totalPix;

      setTodayStats({
        faturamentoBruto,
        totalCalotes,
        faturamentoLiquido,
        totalDinheiro,
        totalCartao,
        totalPix,
      });

      // Also update work_sessions.total_vendido to keep in sync
      await supabase
        .from("work_sessions")
        .update({ total_vendido: faturamentoBruto })
        .eq("user_id", userId)
        .eq("planning_date", today);
    }

    setLoading(false);
  }, [userId]);

  // Initial load
  useEffect(() => {
    loadTodayStats();
  }, [loadTodayStats]);

  // Real-time subscription to hourly_goal_blocks changes
  useEffect(() => {
    if (!userId) return;

    const today = getBrazilDate();

    // First get the plan ID for today
    const setupSubscription = async () => {
      const { data: planData } = await supabase
        .from("daily_goal_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (!planData) return;

      const channel = supabase
        .channel(`dashboard-sync-${planData.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "hourly_goal_blocks",
            filter: `plan_id=eq.${planData.id}`,
          },
          () => {
            // Reload stats whenever blocks change
            loadTodayStats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanup = setupSubscription();

    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [userId, loadTodayStats]);

  return {
    todayStats,
    loading,
    refreshStats: loadTodayStats,
  };
}
