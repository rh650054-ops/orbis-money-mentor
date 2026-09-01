import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { emitMissionEvent } from "@/shared/lib/missionEvents";
import type { DefconBlock } from "@/hooks/useDefconChallenge";

const BLOCK_DURATION = 60 * 60; // 60 min

/**
 * DEFCON em MODO TREINO (onboarding — Fase 4).
 * Espelha a forma do useDefconChallenge, mas e 100% em memoria:
 * NAO le plano do dia, NAO grava streak/faturamento/sessao/estoque,
 * e NAO bloqueia o DEFCON real do dia. Serve so pro tour guiado.
 * O botao rapido ja vem com o valor do produto que o usuario cadastrou.
 */
export function useDefconOnboarding(userId: string | undefined) {
  const [phase, setPhase] = useState<"idle" | "running" | "finished">("idle");
  const [quickSaleValue, setQuickSaleValue] = useState<number>(15);
  const [totalSold, setTotalSold] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [blockSalesCount, setBlockSalesCount] = useState(0);
  const [blockApproaches, setBlockApproaches] = useState(0);
  const [totalApproaches, setTotalApproaches] = useState(0);
  const [blockStartedAt, setBlockStartedAt] = useState<Date | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(BLOCK_DURATION);
  const startedRef = useRef(false);

  // Pega o valor do produto cadastrado pra virar o botao rapido de venda.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("sale_price")
        .eq("user_id", userId)
        .eq("is_active", true)
        .gt("sale_price", 0)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      const v = Number((data as { sale_price?: number } | null)?.sale_price);
      if (v && v > 0) setQuickSaleValue(Math.round(v));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Timer so pra dar realismo (nao encerra o tour — quem encerra e a abordagem).
  useEffect(() => {
    if (phase !== "running" || !blockStartedAt) return;
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - blockStartedAt.getTime()) / 1000);
      setRemainingSeconds(Math.max(0, BLOCK_DURATION - elapsed));
    }, 1000);
    return () => clearInterval(t);
  }, [phase, blockStartedAt]);

  const dailyGoal = Math.max(quickSaleValue * 5, 50);

  const block: DefconBlock = {
    id: "onboarding-block",
    hour_index: 0,
    hour_label: "Treino",
    target_amount: dailyGoal,
    achieved_amount: totalSold,
    is_completed: false,
    valor_dinheiro: totalSold,
    valor_cartao: 0,
    valor_pix: 0,
    valor_calote: 0,
    valor_gorjeta: 0,
  };

  const startChallenge = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setBlockStartedAt(new Date());
    setRemainingSeconds(BLOCK_DURATION);
    setPhase("running");
    emitMissionEvent("defcon-started");
  };

  const addSale = async (amount: number, _method?: "dinheiro" | "pix" | "cartao") => {
    void _method;
    if (amount <= 0) return;
    setTotalSold((s) => s + amount);
    setBlockSalesCount((s) => s + 1);
    setTotalSalesCount((s) => s + 1);
    setBlockApproaches((a) => a + 1);
    setTotalApproaches((a) => a + 1);
  };

  const addTip = async (amount: number) => {
    if (amount > 0) setTotalSold((s) => s + amount);
  };

  const addApproach = () => {
    setBlockApproaches((a) => a + 1);
    setTotalApproaches((a) => a + 1);
  };

  const noop = async () => {};

  return {
    phase,
    blocks: [block],
    currentBlock: block,
    currentBlockIndex: 0,
    dailyGoal,
    totalSold,
    remainingSeconds,
    breakRemaining: 0,
    blockStartedAt,
    blockEndTime: blockStartedAt ? new Date(blockStartedAt.getTime() + BLOCK_DURATION * 1000) : null,
    loading: false,
    hasPlan: true,
    lunchPauseUsed: true,
    lunchPauseRemaining: 0,
    blockApproaches,
    blockSalesCount,
    totalApproaches,
    totalSalesCount,
    blockReportData: null,
    quickSaleValue,
    startChallenge,
    addSale,
    addTip,
    addApproach,
    addOccurrence: noop,
    // ENCERRAR no treino: vira "finished" → o DefconChallenge mostra "treino concluído"
    endChallenge: async () => { setPhase("finished"); },
    savePaymentBreakdown: noop,
    startLunchPause: noop,
    skipLunchPause: () => {},
    skipBreak: () => {},
    dismissBlockReport: () => {},
  };
}
