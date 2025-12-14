import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";

export interface HourlyBlock {
  id: string;
  plan_id: string;
  user_id: string;
  hour_index: number;
  hour_label: string;
  target_amount: number;
  achieved_amount: number;
  is_completed: boolean;
  manual_adjustment: number;
  valor_dinheiro: number;
  valor_cartao: number;
  valor_pix: number;
  valor_calote: number;
  timer_status: string;
  timer_started_at: string | null;
  timer_paused_at: string | null;
  timer_elapsed_seconds: number;
}

export interface DailyBlockStats {
  totalDinheiro: number;
  totalCartao: number;
  totalPix: number;
  totalCalote: number;
  totalVendido: number;
  blocksCompleted: number;
  totalBlocks: number;
}

export function useHourlyBlocks(userId: string | undefined, date?: string) {
  const [blocks, setBlocks] = useState<HourlyBlock[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DailyBlockStats>({
    totalDinheiro: 0,
    totalCartao: 0,
    totalPix: 0,
    totalCalote: 0,
    totalVendido: 0,
    blocksCompleted: 0,
    totalBlocks: 0
  });

  const targetDate = date || getBrazilDate();

  const loadBlocks = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Get plan for the date
    const { data: planData } = await supabase
      .from("daily_goal_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("date", targetDate)
      .maybeSingle();

    if (!planData) {
      setBlocks([]);
      setPlanId(null);
      setLoading(false);
      return;
    }

    setPlanId(planData.id);

    // Get blocks for the plan
    const { data: blocksData } = await supabase
      .from("hourly_goal_blocks")
      .select("*")
      .eq("plan_id", planData.id)
      .order("hour_index");

    if (blocksData) {
      const typedBlocks = blocksData.map(b => ({
        ...b,
        valor_dinheiro: b.valor_dinheiro || 0,
        valor_cartao: b.valor_cartao || 0,
        valor_pix: b.valor_pix || 0,
        valor_calote: b.valor_calote || 0,
        timer_status: b.timer_status || 'idle',
        timer_started_at: b.timer_started_at || null,
        timer_paused_at: b.timer_paused_at || null,
        timer_elapsed_seconds: b.timer_elapsed_seconds || 0
      })) as HourlyBlock[];

      setBlocks(typedBlocks);
      calculateStats(typedBlocks);
    }

    setLoading(false);
  }, [userId, targetDate]);

  const calculateStats = (blocksData: HourlyBlock[]) => {
    const totalDinheiro = blocksData.reduce((sum, b) => sum + (b.valor_dinheiro || 0), 0);
    const totalCartao = blocksData.reduce((sum, b) => sum + (b.valor_cartao || 0), 0);
    const totalPix = blocksData.reduce((sum, b) => sum + (b.valor_pix || 0), 0);
    const totalCalote = blocksData.reduce((sum, b) => sum + (b.valor_calote || 0), 0);
    // Bruto = tudo que foi vendido (incluindo calotes)
    const totalVendido = totalDinheiro + totalCartao + totalPix + totalCalote;
    const blocksCompleted = blocksData.filter(b => b.is_completed).length;

    setStats({
      totalDinheiro,
      totalCartao,
      totalPix,
      totalCalote,
      totalVendido,
      blocksCompleted,
      totalBlocks: blocksData.length
    });
  };

  // Initial load
  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  // Realtime subscription
  useEffect(() => {
    if (!planId) return;

    const channel = supabase
      .channel(`hourly-blocks-${planId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hourly_goal_blocks",
          filter: `plan_id=eq.${planId}`
        },
        () => {
          loadBlocks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [planId, loadBlocks]);

  // Start all timers when "Iniciar Meu Dia" is clicked
  const startDayTimers = async () => {
    if (blocks.length === 0) return;

    // Start only the first block's timer
    const firstBlock = blocks[0];
    if (firstBlock && firstBlock.timer_status === 'idle') {
      await supabase
        .from("hourly_goal_blocks")
        .update({
          timer_status: 'running',
          timer_started_at: new Date().toISOString()
        })
        .eq("id", firstBlock.id);
      
      loadBlocks();
    }
  };

  return {
    blocks,
    planId,
    loading,
    stats,
    loadBlocks,
    startDayTimers
  };
}

// Hook to get block stats for a specific date (for Dashboard/History)
export function useDailyBlockStats(userId: string | undefined, date?: string) {
  const [stats, setStats] = useState<DailyBlockStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      const targetDate = date || getBrazilDate();

      const { data: planData } = await supabase
        .from("daily_goal_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("date", targetDate)
        .maybeSingle();

      if (!planData) {
        setStats(null);
        setLoading(false);
        return;
      }

      const { data: blocksData } = await supabase
        .from("hourly_goal_blocks")
        .select("valor_dinheiro, valor_cartao, valor_pix, valor_calote, is_completed")
        .eq("plan_id", planData.id);

      if (blocksData) {
        const totalDinheiro = blocksData.reduce((sum, b) => sum + ((b as any).valor_dinheiro || 0), 0);
        const totalCartao = blocksData.reduce((sum, b) => sum + ((b as any).valor_cartao || 0), 0);
        const totalPix = blocksData.reduce((sum, b) => sum + ((b as any).valor_pix || 0), 0);
        const totalCalote = blocksData.reduce((sum, b) => sum + ((b as any).valor_calote || 0), 0);
        // Bruto = tudo que foi vendido (incluindo calotes)
        const totalVendido = totalDinheiro + totalCartao + totalPix + totalCalote;
        const blocksCompleted = blocksData.filter(b => b.is_completed).length;

        setStats({
          totalDinheiro,
          totalCartao,
          totalPix,
          totalCalote,
          totalVendido,
          blocksCompleted,
          totalBlocks: blocksData.length
        });
      }

      setLoading(false);
    };

    loadStats();
  }, [userId, date]);

  return { stats, loading };
}
