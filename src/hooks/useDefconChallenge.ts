import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";

const BLOCK_DURATION_SECONDS = 50 * 60; // 50 minutes

export interface ChallengeBlock {
  id: string;
  block_index: number;
  sold_amount: number;
  started_at: string;
  ended_at: string | null;
  status: string;
}

export interface ChallengeSession {
  id: string;
  date: string;
  status: string;
  daily_goal: number;
  total_blocks: number;
  current_block_index: number;
  total_sold: number;
  started_at: string;
  ended_at: string | null;
}

type Phase = "idle" | "running" | "checkpoint" | "finished" | "abandoned";

export function useDefconChallenge(userId: string | undefined) {
  const [session, setSession] = useState<ChallengeSession | null>(null);
  const [currentBlock, setCurrentBlock] = useState<ChallengeBlock | null>(null);
  const [blocks, setBlocks] = useState<ChallengeBlock[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [remainingSeconds, setRemainingSeconds] = useState(BLOCK_DURATION_SECONDS);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing session for today
  const loadSession = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const today = getBrazilDate();
    const { data: sessionData } = await supabase
      .from("challenge_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    if (sessionData) {
      setSession(sessionData as ChallengeSession);

      // Load blocks
      const { data: blocksData } = await supabase
        .from("challenge_blocks")
        .select("*")
        .eq("session_id", sessionData.id)
        .order("block_index", { ascending: true });

      const loadedBlocks = (blocksData || []) as ChallengeBlock[];
      setBlocks(loadedBlocks);

      if (sessionData.status === "completed" || sessionData.status === "abandoned") {
        setPhase(sessionData.status === "completed" ? "finished" : "abandoned");
      } else {
        // Find active block
        const activeBlock = loadedBlocks.find(b => b.status === "active");
        if (activeBlock) {
          setCurrentBlock(activeBlock);
          // Calculate remaining time
          const elapsed = Math.floor(
            (Date.now() - new Date(activeBlock.started_at).getTime()) / 1000
          );
          const remaining = Math.max(0, BLOCK_DURATION_SECONDS - elapsed);
          setRemainingSeconds(remaining);
          if (remaining <= 0) {
            setPhase("checkpoint");
          } else {
            setPhase("running");
          }
        } else {
          // Check if we need a checkpoint for a completed block without sold_amount
          const lastBlock = loadedBlocks[loadedBlocks.length - 1];
          if (lastBlock && lastBlock.status === "completed") {
            setCurrentBlock(lastBlock);
            setPhase("checkpoint");
          } else {
            setPhase("idle");
          }
        }
      }
    } else {
      setPhase("idle");
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Timer countdown
  useEffect(() => {
    if (phase !== "running" || !currentBlock) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - new Date(currentBlock.started_at).getTime()) / 1000
      );
      const remaining = Math.max(0, BLOCK_DURATION_SECONDS - elapsed);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        setPhase("checkpoint");
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentBlock]);

  // Start a new challenge
  const startChallenge = async (dailyGoal: number) => {
    if (!userId) return;

    const today = getBrazilDate();

    // Create session
    const { data: newSession, error } = await supabase
      .from("challenge_sessions")
      .insert({
        user_id: userId,
        date: today,
        daily_goal: dailyGoal,
        status: "active",
        total_blocks: 0,
        current_block_index: 0,
        total_sold: 0,
      })
      .select()
      .single();

    if (error || !newSession) return;

    setSession(newSession as ChallengeSession);

    // Start first block
    await startNextBlock(newSession.id, 0);
  };

  const startNextBlock = async (sessionId: string, blockIndex: number) => {
    if (!userId) return;

    const { data: newBlock, error } = await supabase
      .from("challenge_blocks")
      .insert({
        session_id: sessionId,
        user_id: userId,
        block_index: blockIndex,
        sold_amount: 0,
        status: "active",
      })
      .select()
      .single();

    if (error || !newBlock) return;

    const block = newBlock as ChallengeBlock;
    setCurrentBlock(block);
    setBlocks(prev => [...prev, block]);
    setRemainingSeconds(BLOCK_DURATION_SECONDS);
    setPhase("running");

    // Update session
    await supabase
      .from("challenge_sessions")
      .update({
        current_block_index: blockIndex,
        total_blocks: blockIndex + 1,
      })
      .eq("id", sessionId);

    setSession(prev => prev ? {
      ...prev,
      current_block_index: blockIndex,
      total_blocks: blockIndex + 1,
    } : prev);
  };

  // Submit sales for current block and go to decision
  const submitBlockSales = async (amount: number) => {
    if (!currentBlock || !session || !userId) return;

    // Update block
    await supabase
      .from("challenge_blocks")
      .update({
        sold_amount: amount,
        status: "completed",
        ended_at: new Date().toISOString(),
      })
      .eq("id", currentBlock.id);

    // Update session total
    const newTotal = session.total_sold + amount;
    await supabase
      .from("challenge_sessions")
      .update({ total_sold: newTotal })
      .eq("id", session.id);

    setSession(prev => prev ? { ...prev, total_sold: newTotal } : prev);
    setBlocks(prev =>
      prev.map(b =>
        b.id === currentBlock.id
          ? { ...b, sold_amount: amount, status: "completed", ended_at: new Date().toISOString() }
          : b
      )
    );

    // Return the amount for feedback
    return amount;
  };

  // Advance to next block
  const advanceToNextBlock = async () => {
    if (!session) return;
    const nextIndex = session.current_block_index + 1;
    await startNextBlock(session.id, nextIndex);
  };

  // End challenge (abandon)
  const endChallenge = async () => {
    if (!session) return;

    await supabase
      .from("challenge_sessions")
      .update({
        status: "abandoned",
        ended_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    setSession(prev => prev ? { ...prev, status: "abandoned" } : prev);
    setPhase("abandoned");
  };

  // Complete challenge successfully
  const completeChallenge = async () => {
    if (!session) return;

    await supabase
      .from("challenge_sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    setSession(prev => prev ? { ...prev, status: "completed" } : prev);
    setPhase("finished");
  };

  return {
    session,
    currentBlock,
    blocks,
    phase,
    setPhase,
    remainingSeconds,
    loading,
    startChallenge,
    submitBlockSales,
    advanceToNextBlock,
    endChallenge,
    completeChallenge,
  };
}
