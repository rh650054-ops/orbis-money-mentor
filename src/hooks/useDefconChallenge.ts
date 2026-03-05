import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { celebrationSounds } from "@/utils/celebrationSounds";
import { syncBlocksToDailySales } from "@/utils/syncDailySales";

const BLOCK_DURATION = 60 * 60; // 60 minutes
const BREAK_DURATION = 5 * 60;  // 5 minutes

export type DefconPhase = "idle" | "running" | "break" | "finished" | "abandoned" | "lunch_pause";

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

    setCurrentBlockIndex(nextIdx);
    setBlockStartedAt(startTime);
    setRemainingSeconds(BLOCK_DURATION);
    setPhase("running");
  }, [completeChallenge]);

  const handleBlockTimeUp = useCallback(async () => {
    const idx = currentBlockIndexRef.current;
    const blks = blocksRef.current;
    const currentBlock = blks[idx];

    if (currentBlock) {
      await supabase
        .from("hourly_goal_blocks")
        .update({ is_completed: true, timer_status: "finalizado" })
        .eq("id", currentBlock.id);
    }

    // Play block complete alert sound
    celebrationSounds.playSuccess();

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
          // Past block + break — complete current block and advance
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
        // No timer started — start fresh
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

    // Save how much time was left on the current block
    setPausedBlockRemaining(currentRemaining);
    setLunchPauseDuration(durationMinutes * 60);
    setLunchPauseStartedAt(now);
    setLunchPauseRemaining(durationMinutes * 60);
    setLunchPauseUsed(true);

    // Pause the current block timer in DB
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
      // Set a new timer_started_at so the remaining time matches what was left before pause
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

    // Create or reset challenge session
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

    // Also ensure work_session exists and is active
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

    // Start first block timer
    const firstBlock = blocks[0];
    await supabase
      .from("hourly_goal_blocks")
      .update({ timer_status: "running", timer_started_at: startTime.toISOString() })
      .eq("id", firstBlock.id);

    setCurrentBlockIndex(0);
    setBlockStartedAt(startTime);
    setRemainingSeconds(BLOCK_DURATION);
    setPhase("running");

    // Play DEFCON activation sound
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

    // Sync to dashboard and ranking in real-time
    syncBlocksToDailySales(userId);
  };

  const endChallenge = async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    clearTimer();

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

    // Distribute proportionally across all blocks
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

    // Update local state
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

    // Sync to daily_sales for dashboard
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
    startChallenge,
    addSale,
    endChallenge,
    savePaymentBreakdown,
    startLunchPause,
  };
}
