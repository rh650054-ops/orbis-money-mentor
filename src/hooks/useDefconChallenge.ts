import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { celebrationSounds } from "@/utils/celebrationSounds";
import { syncBlocksToDailySales } from "@/utils/syncDailySales";

const BLOCK_DURATION = 60 * 60; // 60 minutes
const BREAK_DURATION = 5 * 60;  // 5 minutes

export type DefconPhase = "idle" | "running" | "break" | "block_report" | "finished" | "abandoned" | "lunch_pause";

export interface DefconBlock {
  id: string;
  hour_index: number;
  hour_label: string;
  target_amount: number;
  achieved_amount: number;
  is_completed: boolean;
  valor_dinheiro: number;
  valor_cartao: number;
  valor_pix: number;
  valor_calote: number;
}

export interface BlockReportData {
  blockIndex: number;
  approaches: number;
  sales: number;
  soldAmount: number;
}

export function useDefconChallenge(userId: string | undefined) {
  const [phase, setPhase] = useState<DefconPhase>("idle");
  const [blocks, setBlocks] = useState<DefconBlock[]>([]);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(0);
  const [totalSold, setTotalSold] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(BLOCK_DURATION);
  const [breakRemaining, setBreakRemaining] = useState(BREAK_DURATION);
  const [blockStartedAt, setBlockStartedAt] = useState<Date | null>(null);
  const [breakStartedAt, setBreakStartedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPlan, setHasPlan] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lunchPauseUsed, setLunchPauseUsed] = useState(false);
  const [lunchPauseRemaining, setLunchPauseRemaining] = useState(0);
  const [lunchPauseStartedAt, setLunchPauseStartedAt] = useState<Date | null>(null);
  const [lunchPauseDuration, setLunchPauseDuration] = useState(0);
  const [pausedBlockRemaining, setPausedBlockRemaining] = useState(0);
  
  // Approach & sales tracking per block
  const [blockApproaches, setBlockApproaches] = useState(0);
  const [blockSalesCount, setBlockSalesCount] = useState(0);
  const [totalApproaches, setTotalApproaches] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [blockReportData, setBlockReportData] = useState<BlockReportData | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for stable closure access in timer callbacks
  const blocksRef = useRef<DefconBlock[]>([]);
  blocksRef.current = blocks;
  const currentBlockIndexRef = useRef(0);
  currentBlockIndexRef.current = currentBlockIndex;
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;
  const totalSoldRef = useRef(0);
  totalSoldRef.current = totalSold;
  const blockApproachesRef = useRef(0);
  blockApproachesRef.current = blockApproaches;
  const blockSalesCountRef = useRef(0);
  blockSalesCountRef.current = blockSalesCount;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const recalcTotal = (blocksData: DefconBlock[]) => {
    return blocksData.reduce((sum, b) => {
      return sum + (b.valor_dinheiro || 0) + (b.valor_cartao || 0) + (b.valor_pix || 0) + (b.valor_calote || 0);
    }, 0);
  };

  const completeChallenge = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    clearTimer();

    // Save current block approaches to challenge_blocks before finishing
    await saveBlockApproaches(sid, currentBlockIndexRef.current, blockApproachesRef.current);

    await supabase
      .from("challenge_sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        total_sold: totalSoldRef.current,
      })
      .eq("id", sid);

    setPhase("finished");
  }, [clearTimer]);

  const saveBlockApproaches = async (sid: string, blockIdx: number, approaches: number) => {
    // Upsert to challenge_blocks
    const { data: existing } = await supabase
      .from("challenge_blocks")
      .select("id")
      .eq("session_id", sid)
      .eq("block_index", blockIdx)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("challenge_blocks")
        .update({ approaches_count: approaches })
        .eq("id", existing.id);
    } else if (userId) {
      await supabase
        .from("challenge_blocks")
        .insert({
          session_id: sid,
          user_id: userId,
          block_index: blockIdx,
          approaches_count: approaches,
        });
    }
  };

  const advanceToNextBlock = useCallback(async () => {
    const nextIdx = currentBlockIndexRef.current + 1;
    const blks = blocksRef.current;
    const sid = sessionIdRef.current;

    if (nextIdx >= blks.length) {
      await completeChallenge();
      return;
    }

    const nextBlock = blks[nextIdx];
    const startTime = new Date();

    await supabase
      .from("hourly_goal_blocks")
      .update({ timer_status: "running", timer_started_at: startTime.toISOString() })
      .eq("id", nextBlock.id);

    if (sid) {
      await supabase
        .from("challenge_sessions")
        .update({ current_block_index: nextIdx })
        .eq("id", sid);
    }

    // Reset block-level counters
    setBlockApproaches(0);
    setBlockSalesCount(0);

    setCurrentBlockIndex(nextIdx);
    setBlockStartedAt(startTime);
    setRemainingSeconds(BLOCK_DURATION);
    setPhase("running");
  }, [completeChallenge]);

  const handleBlockTimeUp = useCallback(async () => {
    const idx = currentBlockIndexRef.current;
    const blks = blocksRef.current;
    const currentBlock = blks[idx];
    const sid = sessionIdRef.current;

    if (currentBlock) {
      await supabase
        .from("hourly_goal_blocks")
        .update({ is_completed: true, timer_status: "finalizado" })
        .eq("id", currentBlock.id);
    }

    // Save approaches for this block
    if (sid) {
      await saveBlockApproaches(sid, idx, blockApproachesRef.current);
    }

    // Play block complete alert sound
    celebrationSounds.playSuccess();

    // Calculate block sold amount
    const blockSold = currentBlock
      ? (currentBlock.valor_dinheiro + currentBlock.valor_cartao + currentBlock.valor_pix + currentBlock.valor_calote)
      : 0;

    // Show block report before break/finish
    setBlockReportData({
      blockIndex: idx,
      approaches: blockApproachesRef.current,
      sales: blockSalesCountRef.current,
      soldAmount: blockSold,
    });

    if (idx + 1 >= blks.length) {
      // Last block - show report then finish
      clearTimer();
      setPhase("block_report");
    } else {
      clearTimer();
      setPhase("block_report");
    }
  }, [completeChallenge, clearTimer]);

  const dismissBlockReport = useCallback(async () => {
    const idx = currentBlockIndexRef.current;
    const blks = blocksRef.current;

    // Accumulate totals
    setTotalApproaches(prev => prev + blockApproachesRef.current);
    setTotalSalesCount(prev => prev + blockSalesCountRef.current);

    if (idx + 1 >= blks.length) {
      await completeChallenge();
    } else {
      const now = new Date();
      setBreakStartedAt(now);
      setBreakRemaining(BREAK_DURATION);
      setPhase("break");
    }
  }, [completeChallenge]);

  // Load today's plan and blocks
  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const today = getBrazilDate();

    const { data: planData } = await supabase
      .from("daily_goal_plans")
      .select("id, daily_goal")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (!planData) {
      setHasPlan(false);
      setLoading(false);
      return;
    }

    setHasPlan(true);
    setDailyGoal(planData.daily_goal);

    const { data: blocksData } = await supabase
      .from("hourly_goal_blocks")
      .select("id, hour_index, hour_label, target_amount, achieved_amount, is_completed, valor_dinheiro, valor_cartao, valor_pix, valor_calote, timer_started_at")
      .eq("plan_id", planData.id)
      .order("hour_index");

    const loadedBlocks: DefconBlock[] = (blocksData || []).map(b => ({
      id: b.id,
      hour_index: b.hour_index,
      hour_label: b.hour_label,
      target_amount: b.target_amount,
      achieved_amount: b.achieved_amount || 0,
      is_completed: b.is_completed,
      valor_dinheiro: b.valor_dinheiro || 0,
      valor_cartao: b.valor_cartao || 0,
      valor_pix: b.valor_pix || 0,
      valor_calote: b.valor_calote || 0,
    }));

    setBlocks(loadedBlocks);
    const total = recalcTotal(loadedBlocks);
    setTotalSold(total);

    // Check for active DEFCON session
    const { data: session } = await supabase
      .from("challenge_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (session) {
      setSessionId(session.id);

      // Load total approaches from challenge_blocks
      const { data: challengeBlocks } = await supabase
        .from("challenge_blocks")
        .select("approaches_count, block_index")
        .eq("session_id", session.id);

      if (challengeBlocks) {
        const totalApp = challengeBlocks.reduce((sum, b) => sum + (b.approaches_count || 0), 0);
        setTotalApproaches(totalApp);
      }

      if (session.status === "completed") {
        setPhase("finished");
        setLoading(false);
        return;
      }
      if (session.status === "abandoned") {
        setPhase("abandoned");
        setLoading(false);
        return;
      }

      // Active session - resume
      const blockIdx = session.current_block_index;
      setCurrentBlockIndex(blockIdx);

      const currentBlockData = blocksData?.[blockIdx];
      if (currentBlockData?.timer_started_at) {
        const startedAt = new Date(currentBlockData.timer_started_at);
        const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);

        if (elapsed < BLOCK_DURATION) {
          setPhase("running");
          setBlockStartedAt(startedAt);
          setRemainingSeconds(BLOCK_DURATION - elapsed);
        } else if (elapsed < BLOCK_DURATION + BREAK_DURATION) {
          setPhase("break");
          setBreakStartedAt(new Date(startedAt.getTime() + BLOCK_DURATION * 1000));
          setBreakRemaining(BREAK_DURATION - (elapsed - BLOCK_DURATION));
        } else {
          await supabase
            .from("hourly_goal_blocks")
            .update({ is_completed: true, timer_status: "finalizado" })
            .eq("id", currentBlockData.id);

          const nextIdx = blockIdx + 1;
          if (nextIdx >= loadedBlocks.length) {
            await supabase
              .from("challenge_sessions")
              .update({ status: "completed", ended_at: new Date().toISOString(), total_sold: total })
              .eq("id", session.id);
            setPhase("finished");
          } else {
            const now = new Date();
            await supabase
              .from("hourly_goal_blocks")
              .update({ timer_status: "running", timer_started_at: now.toISOString() })
              .eq("id", loadedBlocks[nextIdx].id);
            await supabase
              .from("challenge_sessions")
              .update({ current_block_index: nextIdx })
              .eq("id", session.id);

            setCurrentBlockIndex(nextIdx);
            setBlockStartedAt(now);
            setRemainingSeconds(BLOCK_DURATION);
            setPhase("running");
          }
        }
      } else {
        const now = new Date();
        const currentBlock = loadedBlocks[blockIdx];
        if (currentBlock) {
          await supabase
            .from("hourly_goal_blocks")
            .update({ timer_status: "running", timer_started_at: now.toISOString() })
            .eq("id", currentBlock.id);
          setBlockStartedAt(now);
          setRemainingSeconds(BLOCK_DURATION);
          setPhase("running");
        }
      }
    } else {
      setPhase("idle");
    }

    setLoading(false);
  }, [userId]);

  const startLunchPause = async (durationMinutes: number) => {
    if (!userId || phase !== "running" || lunchPauseUsed) return;

    const now = new Date();
    const currentRemaining = remainingSeconds;

    setPausedBlockRemaining(currentRemaining);
    setLunchPauseDuration(durationMinutes * 60);
    setLunchPauseStartedAt(now);
    setLunchPauseRemaining(durationMinutes * 60);
    setLunchPauseUsed(true);

    const currentBlockData = blocks[currentBlockIndex];
    if (currentBlockData) {
      await supabase
        .from("hourly_goal_blocks")
        .update({ timer_status: "pausado", timer_paused_at: now.toISOString() })
        .eq("id", currentBlockData.id);
    }

    clearTimer();
    setPhase("lunch_pause");
  };

  const resumeFromLunch = useCallback(async () => {
    const now = new Date();
    const currentBlockData = blocksRef.current[currentBlockIndexRef.current];

    if (currentBlockData) {
      const newStartedAt = new Date(now.getTime() - (BLOCK_DURATION - pausedBlockRemaining) * 1000);
      await supabase
        .from("hourly_goal_blocks")
        .update({ timer_status: "running", timer_started_at: newStartedAt.toISOString(), timer_paused_at: null })
        .eq("id", currentBlockData.id);

      setBlockStartedAt(newStartedAt);
      setRemainingSeconds(pausedBlockRemaining);
    }

    setPhase("running");
  }, [pausedBlockRemaining, clearTimer]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Timer countdown
  useEffect(() => {
    clearTimer();

    if (phase === "running" && blockStartedAt) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - blockStartedAt.getTime()) / 1000);
        const remaining = Math.max(0, BLOCK_DURATION - elapsed);
        setRemainingSeconds(remaining);

        if (remaining <= 0) {
          clearTimer();
          handleBlockTimeUp();
        }
      }, 1000);
    } else if (phase === "break" && breakStartedAt) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - breakStartedAt.getTime()) / 1000);
        const remaining = Math.max(0, BREAK_DURATION - elapsed);
        setBreakRemaining(remaining);

        if (remaining <= 0) {
          clearTimer();
          advanceToNextBlock();
        }
      }, 1000);
    } else if (phase === "lunch_pause" && lunchPauseStartedAt && lunchPauseDuration > 0) {
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - lunchPauseStartedAt.getTime()) / 1000);
        const remaining = Math.max(0, lunchPauseDuration - elapsed);
        setLunchPauseRemaining(remaining);

        if (remaining <= 0) {
          clearTimer();
          resumeFromLunch();
        }
      }, 1000);
    }

    return clearTimer;
  }, [phase, blockStartedAt, breakStartedAt, lunchPauseStartedAt, lunchPauseDuration, clearTimer, handleBlockTimeUp, advanceToNextBlock]);

  const startChallenge = async () => {
    if (!userId || blocks.length === 0) return;

    const today = getBrazilDate();
    const startTime = new Date();

    const { data: existingSession } = await supabase
      .from("challenge_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    let sid: string;
    if (existingSession) {
      await supabase
        .from("challenge_sessions")
        .update({
          status: "active",
          daily_goal: dailyGoal,
          total_blocks: blocks.length,
          current_block_index: 0,
          total_sold: totalSold,
          started_at: startTime.toISOString(),
          ended_at: null,
        })
        .eq("id", existingSession.id);
      sid = existingSession.id;
    } else {
      const { data: newSession } = await supabase
        .from("challenge_sessions")
        .insert({
          user_id: userId,
          date: today,
          daily_goal: dailyGoal,
          status: "active",
          total_blocks: blocks.length,
          current_block_index: 0,
          total_sold: totalSold,
        })
        .select("id")
        .single();
      if (!newSession) return;
      sid = newSession.id;
    }

    setSessionId(sid);

    const { data: workSession } = await supabase
      .from("work_sessions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("planning_date", today)
      .maybeSingle();

    if (!workSession) {
      await supabase.from("work_sessions").insert({
        user_id: userId,
        planning_date: today,
        start_timestamp: startTime.toISOString(),
        meta_dia: dailyGoal,
        ritmo_ideal_inicial: dailyGoal / blocks.length,
        status: "active",
      });
    } else if (workSession.status !== "active" && workSession.status !== "finished") {
      await supabase
        .from("work_sessions")
        .update({ status: "active", start_timestamp: startTime.toISOString() })
        .eq("id", workSession.id);
    }

    const firstBlock = blocks[0];
    await supabase
      .from("hourly_goal_blocks")
      .update({ timer_status: "running", timer_started_at: startTime.toISOString() })
      .eq("id", firstBlock.id);

    // Reset block counters (totals are loaded from DB or start at 0 for new sessions)
    setBlockApproaches(0);
    setBlockSalesCount(0);
    if (!existingSession) {
      setTotalApproaches(0);
      setTotalSalesCount(0);
    }

    setCurrentBlockIndex(0);
    setBlockStartedAt(startTime);
    setRemainingSeconds(BLOCK_DURATION);
    setPhase("running");

    celebrationSounds.playDefconActivation();
  };

  const addSale = async (amount: number) => {
    if (!userId || phase !== "running" || amount <= 0) return;

    const currentBlock = blocks[currentBlockIndex];
    if (!currentBlock) return;

    const newDinheiro = currentBlock.valor_dinheiro + amount;
    const newAchieved = newDinheiro + currentBlock.valor_cartao + currentBlock.valor_pix + currentBlock.valor_calote;
    const newTotal = totalSold + amount;

    await supabase
      .from("hourly_goal_blocks")
      .update({ achieved_amount: newAchieved, valor_dinheiro: newDinheiro })
      .eq("id", currentBlock.id);

    if (sessionId) {
      await supabase
        .from("challenge_sessions")
        .update({ total_sold: newTotal })
        .eq("id", sessionId);
    }

    setBlocks(prev =>
      prev.map((b, i) =>
        i === currentBlockIndex
          ? { ...b, achieved_amount: newAchieved, valor_dinheiro: newDinheiro }
          : b
      )
    );
    setTotalSold(newTotal);
    setBlockSalesCount(prev => prev + 1);

    // Auto-increment approach: whoever bought was approached
    setBlockApproaches(prev => prev + 1);
    setTotalApproaches(prev => prev + 1);

    await syncBlocksToDailySales(userId);
  };

  const addApproach = () => {
    if (phase !== "running") return;
    setBlockApproaches(prev => prev + 1);
  };

  const addOccurrence = async (description: string) => {
    if (!userId || !sessionId) return;
    await supabase.from("defcon_occurrences").insert({
      user_id: userId,
      session_id: sessionId,
      block_index: currentBlockIndex,
      description,
    });
  };

  const endChallenge = async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    clearTimer();

    // Save current block approaches
    await saveBlockApproaches(sid, currentBlockIndexRef.current, blockApproachesRef.current);
    setTotalApproaches(prev => prev + blockApproachesRef.current);
    setTotalSalesCount(prev => prev + blockSalesCountRef.current);

    await supabase
      .from("challenge_sessions")
      .update({ status: "abandoned", ended_at: new Date().toISOString(), total_sold: totalSoldRef.current })
      .eq("id", sid);

    setPhase("abandoned");
  };

  const savePaymentBreakdown = async (dinheiro: number, cartao: number, pix: number) => {
    if (!userId) return;
    const total = totalSoldRef.current;
    const calote = Math.max(0, total - (dinheiro + cartao + pix));

    const blks = blocksRef.current;
    const totalFromBlocks = blks.reduce((sum, b) => sum + b.valor_dinheiro + b.valor_cartao + b.valor_pix + b.valor_calote, 0);

    for (const block of blks) {
      const blockTotal = block.valor_dinheiro + block.valor_cartao + block.valor_pix + block.valor_calote;
      if (blockTotal <= 0 || totalFromBlocks <= 0) continue;

      const ratio = blockTotal / totalFromBlocks;
      const bDinheiro = Math.round(dinheiro * ratio * 100) / 100;
      const bCartao = Math.round(cartao * ratio * 100) / 100;
      const bPix = Math.round(pix * ratio * 100) / 100;
      const bCalote = Math.round(calote * ratio * 100) / 100;

      await supabase
        .from("hourly_goal_blocks")
        .update({
          valor_dinheiro: bDinheiro,
          valor_cartao: bCartao,
          valor_pix: bPix,
          valor_calote: bCalote,
          achieved_amount: bDinheiro + bCartao + bPix + bCalote,
        })
        .eq("id", block.id);
    }

    setBlocks(prev =>
      prev.map(b => {
        const blockTotal = b.valor_dinheiro + b.valor_cartao + b.valor_pix + b.valor_calote;
        if (blockTotal <= 0 || totalFromBlocks <= 0) return b;
        const ratio = blockTotal / totalFromBlocks;
        const bDinheiro = Math.round(dinheiro * ratio * 100) / 100;
        const bCartao = Math.round(cartao * ratio * 100) / 100;
        const bPix = Math.round(pix * ratio * 100) / 100;
        const bCalote = Math.round(calote * ratio * 100) / 100;
        return {
          ...b,
          valor_dinheiro: bDinheiro,
          valor_cartao: bCartao,
          valor_pix: bPix,
          valor_calote: bCalote,
          achieved_amount: bDinheiro + bCartao + bPix + bCalote,
        };
      })
    );

    await syncBlocksToDailySales(userId);
  };

  const blockEndTime = blockStartedAt
    ? new Date(blockStartedAt.getTime() + BLOCK_DURATION * 1000)
    : null;

  const currentBlock = blocks[currentBlockIndex] || null;

  return {
    phase,
    blocks,
    currentBlock,
    currentBlockIndex,
    dailyGoal,
    totalSold,
    remainingSeconds,
    breakRemaining,
    blockStartedAt,
    blockEndTime,
    loading,
    hasPlan,
    lunchPauseUsed,
    lunchPauseRemaining,
    blockApproaches,
    blockSalesCount,
    totalApproaches,
    totalSalesCount,
    blockReportData,
    startChallenge,
    addSale,
    addApproach,
    addOccurrence,
    endChallenge,
    savePaymentBreakdown,
    startLunchPause,
    dismissBlockReport,
  };
}
