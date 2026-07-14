import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { celebrationSounds } from "@/shared/lib/celebration-sounds";
import { syncBlocksToDailySales } from "@/utils/syncDailySales";
import { addOfflineRecord } from "@/shared/lib/offline-db";

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
  valor_gorjeta: number;
}

export interface BlockReportData {
  blockIndex: number;
  approaches: number;
  sales: number;
  soldAmount: number;
}

/**
 * Offline: enfileira o ESTADO ABSOLUTO de um bloco no celular pra subir quando a
 * conexao voltar. Idempotente — a fila usa o id do bloco como chave e syncSaleRecord
 * faz upsert com valores absolutos, entao re-aplicar (ou aplicar 2x) NUNCA duplica dinheiro.
 */
async function queueBlockOffline(
  block: {
    id: string; hour_index: number; hour_label: string; target_amount: number;
    achieved_amount: number; valor_dinheiro: number; valor_cartao: number;
    valor_pix: number; valor_calote: number; valor_gorjeta: number;
  },
  userId: string,
  planId: string | null,
) {
  try {
    await addOfflineRecord("pending_sales", {
      id: block.id,
      store: "pending_sales",
      data: {
        block_id: block.id,
        user_id: userId,
        plan_id: planId ?? "",
        hour_index: block.hour_index,
        hour_label: block.hour_label,
        target_amount: block.target_amount,
        achieved_amount: block.achieved_amount,
        valor_dinheiro: block.valor_dinheiro,
        valor_cartao: block.valor_cartao,
        valor_pix: block.valor_pix,
        valor_calote: block.valor_calote,
        valor_gorjeta: block.valor_gorjeta,
      },
      created_at: new Date().toISOString(),
      synced: false,
    });
  } catch {
    // IndexedDB indisponivel (aba anonima / storage cheio): resta so o estado otimista da tela.
  }
}

// Tempo REALMENTE trabalhado ao encerrar. O wall-clock (fim − início) inclui almoço e
// intervalos, então tem teto. Mas o teto NÃO pode assumir o bloco atual inteiro (60min) —
// senão finalizar 22min dentro da 6ª hora "cravava" em 6h. Teto = blocos COMPLETOS × 60 +
// minutos decorridos no bloco atual (limitado a 60). blockStart = início do bloco atual.
function calcWorkedMinutes(
  startedAtISO: string,
  endedAt: Date,
  blockIndex: number,
  blockStart: Date | null,
): number {
  const wall = Math.round((endedAt.getTime() - new Date(startedAtISO).getTime()) / 60000);
  const elapsedInBlock = blockStart
    ? Math.min(60, Math.max(0, (endedAt.getTime() - blockStart.getTime()) / 60000))
    : 60; // sem info do bloco → assume bloco cheio (fallback conservador)
  const capReal = blockIndex * 60 + elapsedInBlock;
  return Math.max(0, Math.round(Math.min(wall, capReal)));
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
  // Tempo trabalhado RECONSTRUÍDO de uma sessão já encerrada (sobrevive ao reload).
  // null = sessão não encerrada -> usa o cálculo ao vivo (currentBlockIndex/remainingSeconds).
  const [workedMinutes, setWorkedMinutes] = useState<number | null>(null);
  
  // Approach & sales tracking per block
  const [blockApproaches, setBlockApproaches] = useState(0);
  const [blockSalesCount, setBlockSalesCount] = useState(0);
  const [totalApproaches, setTotalApproaches] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);
  const [blockReportData, setBlockReportData] = useState<BlockReportData | null>(null);

  // Per-sale rows for the current session (additive — aggregates remain source of truth).
  const [sessionSales, setSessionSales] = useState<any[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for stable closure access in timer callbacks
  const blocksRef = useRef<DefconBlock[]>([]);
  blocksRef.current = blocks;
  const blockStartedAtRef = useRef<Date | null>(null);
  blockStartedAtRef.current = blockStartedAt;
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
  const planIdRef = useRef<string | null>(null);
  const dailyGoalRef = useRef(0);
  dailyGoalRef.current = dailyGoal;

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

    const endedAt = new Date();
    const { data: doneSession } = await supabase
      .from("challenge_sessions")
      .update({
        status: "completed",
        ended_at: endedAt.toISOString(),
        total_sold: totalSoldRef.current,
      })
      .eq("id", sid)
      .select("started_at")
      .maybeSingle();

    // Tempo trabalhado AO VIVO — blocos completos + parcial do bloco atual (sem cravar hora cheia).
    // Persiste na sessão pra o RELATÓRIO somar o tempo real (sem almoço/intervalos).
    if (doneSession?.started_at) {
      const worked = calcWorkedMinutes(doneSession.started_at, endedAt, currentBlockIndexRef.current, blockStartedAtRef.current);
      setWorkedMinutes(worked);
      await supabase.from("challenge_sessions").update({ worked_minutes: worked } as never).eq("id", sid);
    }

    setPhase("finished");
  }, [clearTimer]);

  const saveBlockApproaches = async (sid: string, blockIdx: number, approaches: number, sales?: number) => {
    if (!userId) return;
    // Upsert ATÔMICO — depende da constraint única (session_id, block_index).
    // O método antigo usava .maybeSingle(), que retorna erro/null quando há 2+ linhas:
    // bastava uma corrida inicial criar 2 linhas pro mesmo bloco e, a partir daí,
    // cada novo save reinseria uma linha (cascata) — foi o que inflou as abordagens (286).
    const payload: any = {
      session_id: sid,
      user_id: userId,
      block_index: blockIdx,
      approaches_count: approaches,
    };
    if (sales !== undefined) payload.sales_count = sales;
    await supabase
      .from("challenge_blocks")
      .upsert(payload, { onConflict: "session_id,block_index" });
  };

  // Carrega as vendas-linha (defcon_sales) da sessão atual em ordem cronológica.
  // Aditivo: alimenta a UI de detalhe por venda; os agregados continuam sendo a verdade.
  const loadSessionSales = useCallback(async (sid?: string | null) => {
    const id = sid ?? sessionIdRef.current;
    if (!id) {
      setSessionSales([]);
      return;
    }
    const { data } = await supabase
      .from("defcon_sales")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: true });
    setSessionSales(data || []);
  }, []);

  const advanceToNextBlock = useCallback(async () => {
    const nextIdx = currentBlockIndexRef.current + 1;
    const blks = blocksRef.current;
    const sid = sessionIdRef.current;

    if (nextIdx >= blks.length) {
      await completeChallenge();
      return;
    }

    const nextBlock = blks[nextIdx];
    if (!nextBlock) return;
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

    // Totals are already accumulated in real-time via addSale/addApproach
    // No need to add blockSalesCount again — it's already in totalSalesCount

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
    setWorkedMinutes(null); // recalculado abaixo só p/ sessões já encerradas

    const today = getBrazilDate();

    let { data: planData } = await supabase
      .from("daily_goal_plans")
      .select("id, daily_goal, date")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    // Segurança de meia-noite: se NÃO há plano para "hoje", mas existe uma
    // challenge_session ainda ATIVA de uma data anterior (vendedor virou a
    // meia-noite com o Defcon rodando), mantemos essa sessão carregada usando
    // o plano/blocos da data DELA — em vez de resetar para "sem plano".
    let effectiveDate = today;
    let carriedSession: any = null;
    if (!planData) {
      const { data: activeSession } = await supabase
        .from("challenge_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .is("ended_at", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSession) {
        const { data: prevPlan } = await supabase
          .from("daily_goal_plans")
          .select("id, daily_goal, date")
          .eq("user_id", userId)
          .eq("date", activeSession.date)
          .maybeSingle();

        if (prevPlan) {
          planData = prevPlan;
          effectiveDate = activeSession.date;
          carriedSession = activeSession;
        }
      }
    }

    if (!planData) {
      setHasPlan(false);
      setLoading(false);
      return;
    }

    setHasPlan(true);
    setDailyGoal(planData.daily_goal);
    planIdRef.current = planData.id;

    const { data: blocksData } = await supabase
      .from("hourly_goal_blocks")
      .select("id, hour_index, hour_label, target_amount, achieved_amount, is_completed, valor_dinheiro, valor_cartao, valor_pix, valor_calote, valor_gorjeta, timer_started_at")
      .eq("plan_id", planData.id)
      .order("hour_index");

    const loadedBlocks: DefconBlock[] = (blocksData || []).map((b: any) => ({
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
      valor_gorjeta: b.valor_gorjeta || 0,
    }));

    setBlocks(loadedBlocks);
    const total = recalcTotal(loadedBlocks);
    setTotalSold(total);

    // Check for active DEFCON session (reaproveita a sessão carregada na
    // segurança de meia-noite, se houver; senão busca a sessão da data efetiva)
    let session = carriedSession;
    if (!session) {
      const { data: todaySession } = await supabase
        .from("challenge_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("date", effectiveDate)
        .maybeSingle();
      session = todaySession;
    }

    if (session) {
      setSessionId(session.id);

      // Carrega as vendas-linha da sessão (aditivo — não afeta agregados).
      await loadSessionSales(session.id);

      // Load total approaches and current block approaches from challenge_blocks
      const { data: challengeBlocks } = await supabase
        .from("challenge_blocks")
        .select("approaches_count, block_index, sales_count")
        .eq("session_id", session.id);

      if (challengeBlocks) {
        const totalApp = challengeBlocks.reduce((sum, b) => sum + (b.approaches_count || 0), 0);
        setTotalApproaches(totalApp);

        // Restaura o número real de vendas SOMANDO sales_count de cada bloco.
        // (Antes lia sold_amount, coluna que nunca é gravada -> sempre 0, zerando as vendas.)
        const totalSls = challengeBlocks.reduce((sum, b) => sum + Number((b as any).sales_count || 0), 0);
        setTotalSalesCount(totalSls);

        // Restaura abordagens + vendas do bloco atual
        const currentChallengeBlock = challengeBlocks.find(b => b.block_index === session.current_block_index);
        if (currentChallengeBlock) {
          setBlockApproaches(currentChallengeBlock.approaches_count || 0);
          setBlockSalesCount(Number((currentChallengeBlock as any).sales_count || 0));
        }
      }

      if (session.status === "completed" || session.status === "abandoned") {
        // Tempo trabalhado reconstruído: blocos COMPLETOS + parcial do bloco atual (nunca a
        // hora cheia). O wall-clock (fim − início) inclui almoço/intervalos, então serve só de
        // teto de segurança. blockStart do bloco atual vem do timer_started_at daquele bloco.
        const idx = session.current_block_index || 0;
        setCurrentBlockIndex(idx);
        if (session.started_at && session.ended_at) {
          const curTimer = (blocksData?.[idx] as { timer_started_at?: string } | undefined)?.timer_started_at;
          const blockStart = curTimer ? new Date(curTimer) : null;
          setWorkedMinutes(calcWorkedMinutes(session.started_at, new Date(session.ended_at), idx, blockStart));
        } else {
          setWorkedMinutes(0);
        }
        setPhase(session.status === "completed" ? "finished" : "abandoned");
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
          // RESTORE NÃO-DESTRUTIVO: o tempo real passou da janela do bloco
          // enquanto o app estava em segundo plano (PWA morto + reload).
          // NÃO auto-completamos o bloco, NÃO avançamos o current_block_index
          // e NÃO finalizamos a sessão — isso apagava o bloco atual + contadores
          // + conversão do usuário no reload. Em vez disso, mantemos o MESMO
          // bloco com seus contadores persistidos e representamos o timer como
          // "encerrado" (remainingSeconds = 0), deixando a UI mostrar "tempo
          // esgotado". O usuário avança o bloco pelo controle normal do app.
          setPhase("running");
          setBlockStartedAt(startedAt);
          setRemainingSeconds(0);
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
  }, [userId, loadSessionSales]);

  const startLunchPause = async (durationMinutes: number) => {
    if (!userId || phase !== "running" || lunchPauseUsed) return;

    // Trava a duração: um dedo errado (ex.: 180 em vez de 18) prendia o vendedor
    // 3 horas na tela de almoço. Máximo 120 min.
    const mins = Math.max(1, Math.min(120, Math.floor(durationMinutes) || 0));
    if (mins <= 0) return;

    const now = new Date();
    const currentRemaining = remainingSeconds;

    setPausedBlockRemaining(currentRemaining);
    setLunchPauseDuration(mins * 60);
    setLunchPauseStartedAt(now);
    setLunchPauseRemaining(mins * 60);
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

  const skipBreak = useCallback(() => {
    clearTimer();
    advanceToNextBlock();
  }, [clearTimer, advanceToNextBlock]);

  const skipLunchPause = useCallback(() => {
    clearTimer();
    resumeFromLunch();
  }, [clearTimer, resumeFromLunch]);

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
    } else if (phase === "lunch_pause") {
      // Estado inconsistente: está em "almoço" mas sem início/duração (ex.: o app
      // recarregou no meio da pausa). Antes ficava travado pra sempre nessa tela,
      // sem contador. Agora volta pro desafio na hora.
      clearTimer();
      resumeFromLunch();
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
    if (!firstBlock) return;
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
    setWorkedMinutes(null);
    setPhase("running");

    celebrationSounds.playDefconActivation();
  };

  const addSale = async (amount: number, method: "dinheiro" | "pix" | "cartao" = "dinheiro") => {
    if (!userId || phase !== "running" || amount <= 0) return;

    const currentBlock = blocks[currentBlockIndex];
    if (!currentBlock) return;

    const newDinheiro = currentBlock.valor_dinheiro + (method === "dinheiro" ? amount : 0);
    const newPix = currentBlock.valor_pix + (method === "pix" ? amount : 0);
    const newCartao = currentBlock.valor_cartao + (method === "cartao" ? amount : 0);
    const newAchieved = newDinheiro + newCartao + newPix + currentBlock.valor_calote;
    const newTotal = totalSold + amount;
    const newBlockSales = blockSalesCount + 1;
    const newApproaches = blockApproaches + 1; // quem comprou foi abordado

    // OTIMISTA: atualiza a TELA na hora (sem esperar a rede). É isso que deixa o
    // toque instantâneo — a gravação no banco acontece logo em seguida, em background.
    setBlocks(prev =>
      prev.map((b, i) =>
        i === currentBlockIndex
          ? { ...b, achieved_amount: newAchieved, valor_dinheiro: newDinheiro, valor_pix: newPix, valor_cartao: newCartao }
          : b
      )
    );
    setTotalSold(newTotal);
    setBlockSalesCount(newBlockSales);
    setTotalSalesCount(prev => prev + 1);
    setBlockApproaches(newApproaches);
    setTotalApproaches(prev => prev + 1);

    // Persiste no banco. IMPORTANTE: o supabase-js NAO lanca excecao quando esta
    // offline — ele RETORNA { error }. Por isso a gente (1) checa navigator.onLine pra
    // enfileirar direto sem nem tentar a rede e (2) checa o error retornado como
    // fallback. Enfileira o estado ABSOLUTO do bloco (idempotente no upsert por id).
    const blockState = {
      ...currentBlock,
      achieved_amount: newAchieved,
      valor_dinheiro: newDinheiro,
      valor_pix: newPix,
      valor_cartao: newCartao,
    };
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await queueBlockOffline(blockState, userId, planIdRef.current);
      return;
    }
    try {
      const { error: blkErr } = await supabase
        .from("hourly_goal_blocks")
        .update({
          achieved_amount: newAchieved,
          valor_dinheiro: newDinheiro,
          valor_pix: newPix,
          valor_cartao: newCartao,
        })
        .eq("id", currentBlock.id);
      if (blkErr) throw blkErr;

      if (sessionId) {
        await supabase
          .from("challenge_sessions")
          .update({ total_sold: newTotal })
          .eq("id", sessionId);
        await saveBlockApproaches(sessionId, currentBlockIndex, newApproaches, newBlockSales);
        // Registra a venda como LINHA em defcon_sales (pra listar/editar/excluir).
        await supabase.from("defcon_sales").insert({
          user_id: userId,
          session_id: sessionId,
          block_index: currentBlockIndex,
          amount,
          method,
          late: false,
        });
      }

      await syncBlocksToDailySales(userId);
      if (sessionId) await loadSessionSales(sessionId);
    } catch (e) {
      // Rede caiu no meio (ou { error } retornado): enfileira pra subir ao reconectar.
      await queueBlockOffline(blockState, userId, planIdRef.current);
    }
  };

  // Exclui UMA venda-linha (defcon_sales) e REVERTE seu efeito nos agregados do
  // bloco dela — espelhando addSale ao contrário. Dinheiro sempre é estornado;
  // sales_count só decrementa se NÃO for pix-depois (que nunca somou conversão).
  const deleteSale = async (sale: any) => {
    if (!userId || !sale?.id) return;

    const amount = Number(sale.amount) || 0;
    const isTip = sale.method === "gorjeta";
    const method: "dinheiro" | "pix" | "cartao" =
      sale.method === "pix" || sale.method === "cartao" ? sale.method : "dinheiro";
    const blockIdx = Number(sale.block_index) || 0;
    const isLate = !!sale.late;

    // 1) Apaga a linha.
    await supabase.from("defcon_sales").delete().eq("id", sale.id);

    // 2) Reverte os agregados no BLOCO da venda (não necessariamente o atual).
    const targetBlock = blocks[blockIdx];
    if (targetBlock) {
      // Gorjeta entra como dinheiro E em valor_gorjeta, então ao cancelar estorna os dois.
      const newDinheiro = Math.max(0, targetBlock.valor_dinheiro - (method === "dinheiro" ? amount : 0));
      const newPix = Math.max(0, targetBlock.valor_pix - (method === "pix" ? amount : 0));
      const newCartao = Math.max(0, targetBlock.valor_cartao - (method === "cartao" ? amount : 0));
      const newGorjeta = Math.max(0, (targetBlock.valor_gorjeta || 0) - (isTip ? amount : 0));
      const newAchieved = Math.max(0, newDinheiro + newCartao + newPix + targetBlock.valor_calote);

      await supabase
        .from("hourly_goal_blocks")
        .update({
          achieved_amount: newAchieved,
          valor_dinheiro: newDinheiro,
          valor_pix: newPix,
          valor_cartao: newCartao,
          valor_gorjeta: newGorjeta,
        })
        .eq("id", targetBlock.id);

      setBlocks(prev =>
        prev.map((b, i) =>
          i === blockIdx
            ? { ...b, achieved_amount: newAchieved, valor_dinheiro: newDinheiro, valor_pix: newPix, valor_cartao: newCartao, valor_gorjeta: newGorjeta }
            : b
        )
      );
    }

    // 3) Estorna total_sold da sessão (piso 0).
    const newTotal = Math.max(0, totalSold - amount);
    if (sessionId) {
      await supabase.from("challenge_sessions").update({ total_sold: newTotal }).eq("id", sessionId);
    }
    setTotalSold(newTotal);

    // 4) venda E abordagem: tocar em "venda" soma 1 abordagem automaticamente,
    //    então ao excluir a venda a gente tira a venda E a abordagem.
    //    (pix-depois nunca somou venda nem abordagem, então não mexe.)
    if (!isLate && !isTip && sessionId) {
      const { data: cb } = await supabase
        .from("challenge_blocks")
        .select("approaches_count, sales_count")
        .eq("session_id", sessionId)
        .eq("block_index", blockIdx)
        .maybeSingle();
      const curApproaches = Number((cb as any)?.approaches_count || 0);
      const curSales = Number((cb as any)?.sales_count || 0);
      const newSales = Math.max(0, curSales - 1);
      const newApproaches = Math.max(0, curApproaches - 1);
      await saveBlockApproaches(sessionId, blockIdx, newApproaches, newSales);

      // Atualiza contadores locais (do bloco atual e total).
      setTotalSalesCount(prev => Math.max(0, prev - 1));
      setTotalApproaches(prev => Math.max(0, prev - 1));
      if (blockIdx === currentBlockIndex) {
        setBlockSalesCount(prev => Math.max(0, prev - 1));
        setBlockApproaches(prev => Math.max(0, prev - 1));
      }
    }

    // 5) Mesma cauda do addSale: ressincroniza daily_sales e recarrega a lista.
    await syncBlocksToDailySales(userId);
    await loadSessionSales(sessionId);
  };

  // "Pix que caiu depois": pagamento atrasado de uma venda já registrada.
  // Soma SÓ dinheiro (valor_pix + achieved_amount + total_sold) — NÃO mexe em
  // sales_count nem abordagens, porque não é uma nova conversão.
  const addLatePix = async (amount: number) => {
    if (!userId || amount <= 0) return;

    const blockIdx = currentBlockIndex;
    const currentBlock = blocks[blockIdx];
    if (!currentBlock) return;

    const newPix = currentBlock.valor_pix + amount;
    const newAchieved = currentBlock.valor_dinheiro + currentBlock.valor_cartao + newPix + currentBlock.valor_calote;
    const newTotal = totalSold + amount;

    // OTIMISTA: tela na hora; banco em seguida.
    setBlocks(prev =>
      prev.map((b, i) =>
        i === blockIdx ? { ...b, achieved_amount: newAchieved, valor_pix: newPix } : b
      )
    );
    setTotalSold(newTotal);

    const blockState = { ...currentBlock, achieved_amount: newAchieved, valor_pix: newPix };
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await queueBlockOffline(blockState, userId, planIdRef.current);
      return;
    }
    try {
      const { error: blkErr } = await supabase
        .from("hourly_goal_blocks")
        .update({
          achieved_amount: newAchieved,
          valor_pix: newPix,
        })
        .eq("id", currentBlock.id);
      if (blkErr) throw blkErr;

      if (sessionId) {
        await supabase.from("challenge_sessions").update({ total_sold: newTotal }).eq("id", sessionId);
        await supabase.from("defcon_sales").insert({
          user_id: userId,
          session_id: sessionId,
          block_index: blockIdx,
          amount,
          method: "pix",
          late: true,
        });
      }

      await syncBlocksToDailySales(userId);
      if (sessionId) await loadSessionSales(sessionId);
    } catch (e) {
      // Offline / rede caiu: enfileira o estado do bloco pra sincronizar depois.
      await queueBlockOffline(blockState, userId, planIdRef.current);
    }
  };

  const addTip = async (amount: number) => {
    if (!userId || phase !== "running" || amount <= 0) return;
    const currentBlock = blocks[currentBlockIndex];
    if (!currentBlock) return;

    const newDinheiro = currentBlock.valor_dinheiro + amount;
    const newGorjeta = (currentBlock.valor_gorjeta || 0) + amount;
    const newAchieved = newDinheiro + currentBlock.valor_cartao + currentBlock.valor_pix + currentBlock.valor_calote;
    const newTotal = totalSold + amount;

    // OTIMISTA: tela na hora; banco em seguida.
    setBlocks(prev =>
      prev.map((b, i) =>
        i === currentBlockIndex
          ? { ...b, achieved_amount: newAchieved, valor_dinheiro: newDinheiro, valor_gorjeta: newGorjeta }
          : b
      )
    );
    setTotalSold(newTotal);

    const blockState = { ...currentBlock, achieved_amount: newAchieved, valor_dinheiro: newDinheiro, valor_gorjeta: newGorjeta };
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await queueBlockOffline(blockState, userId, planIdRef.current);
      return;
    }
    try {
      const { error: blkErr } = await supabase
        .from("hourly_goal_blocks")
        .update({
          achieved_amount: newAchieved,
          valor_dinheiro: newDinheiro,
          valor_gorjeta: newGorjeta,
        })
        .eq("id", currentBlock.id);
      if (blkErr) throw blkErr;

      if (sessionId) {
        await supabase.from("challenge_sessions").update({ total_sold: newTotal }).eq("id", sessionId);
        // Registra a gorjeta como LINHA em defcon_sales (method='gorjeta') pra aparecer
        // no histórico de vendas e poder ser cancelada. NÃO conta venda/abordagem.
        await supabase.from("defcon_sales").insert({
          user_id: userId,
          session_id: sessionId,
          block_index: currentBlockIndex,
          amount,
          method: "gorjeta",
          late: false,
        });
      }

      await syncBlocksToDailySales(userId);
      if (sessionId) await loadSessionSales(sessionId);
    } catch (e) {
      // Offline / rede caiu: enfileira o estado do bloco (com a gorjeta) pra sincronizar depois.
      await queueBlockOffline(blockState, userId, planIdRef.current);
    }
  };

  const addApproach = async () => {
    if (phase !== "running") return;
    const newApproaches = blockApproaches + 1;
    setBlockApproaches(newApproaches);
    setTotalApproaches(prev => prev + 1);

    // Persist to DB immediately (passa também as vendas do bloco pra manter o upsert consistente).
    // AWAIT obrigatório: garante que a abordagem fique gravada antes de retornar,
    // pra não perder a última contagem se o app for morto logo após o toque.
    if (sessionId) {
      await saveBlockApproaches(sessionId, currentBlockIndex, newApproaches, blockSalesCount);
    }
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
    // Totals already accumulated in real-time — no need to add again

    const endedAt = new Date();
    const { data: doneSession } = await supabase
      .from("challenge_sessions")
      .update({ status: "abandoned", ended_at: endedAt.toISOString(), total_sold: totalSoldRef.current })
      .eq("id", sid)
      .select("started_at")
      .maybeSingle();

    // Encerramento manual — blocos completos + parcial do bloco atual (sem cravar hora cheia).
    if (doneSession?.started_at) {
      const worked = calcWorkedMinutes(doneSession.started_at, endedAt, currentBlockIndexRef.current, blockStartedAtRef.current);
      setWorkedMinutes(worked);
      await supabase.from("challenge_sessions").update({ worked_minutes: worked } as never).eq("id", sid);
    }

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

  // Estende o Defcon por +1 bloco de 1h, mantendo todos os dados.
  const extendChallenge = async () => {
    const sid = sessionIdRef.current;
    const pid = planIdRef.current;
    if (!sid || !pid || !userId) return;

    const blks = blocksRef.current;
    const lastBlock = blks[blks.length - 1];
    const newHourIndex = (lastBlock?.hour_index ?? blks.length - 1) + 1;
    const targetAmount = lastBlock?.target_amount ?? (dailyGoalRef.current / Math.max(blks.length, 1));
    const startTime = new Date();

    const { data: newBlock } = await supabase
      .from("hourly_goal_blocks")
      .insert({
        plan_id: pid,
        user_id: userId,
        hour_index: newHourIndex,
        hour_label: "⏱ +1h",
        target_amount: targetAmount,
        achieved_amount: 0,
        is_completed: false,
        timer_status: "running",
        timer_started_at: startTime.toISOString(),
        valor_dinheiro: 0,
        valor_cartao: 0,
        valor_pix: 0,
        valor_calote: 0,
        valor_gorjeta: 0,
      })
      .select("id")
      .single();

    if (!newBlock) return;

    const newBlockData: DefconBlock = {
      id: newBlock.id,
      hour_index: newHourIndex,
      hour_label: "⏱ +1h",
      target_amount: targetAmount,
      achieved_amount: 0,
      is_completed: false,
      valor_dinheiro: 0,
      valor_cartao: 0,
      valor_pix: 0,
      valor_calote: 0,
      valor_gorjeta: 0,
    };

    const newBlocks = [...blks, newBlockData];
    const newIdx = newBlocks.length - 1;

    await supabase
      .from("challenge_sessions")
      .update({ status: "active", ended_at: null, total_blocks: newBlocks.length, current_block_index: newIdx })
      .eq("id", sid);

    setBlocks(newBlocks);
    setCurrentBlockIndex(newIdx);
    setBlockStartedAt(startTime);
    setRemainingSeconds(BLOCK_DURATION);
    setBlockApproaches(0);
    setBlockSalesCount(0);
    setWorkedMinutes(null);
    setPhase("running");
  };

  // Apaga todos os dados do dia e volta para idle (começo do zero).
  const restartChallenge = async () => {
    if (!userId || !planIdRef.current) return;
    clearTimer();

    const today = getBrazilDate();
    const sid = sessionIdRef.current;
    const pid = planIdRef.current;

    // Apaga challenge_blocks e challenge_session do dia
    if (sid) {
      await supabase.from("challenge_blocks").delete().eq("session_id", sid);
      await supabase.from("challenge_sessions").delete().eq("id", sid);
    }

    // Remove blocos de extensão (⏱ +1h) criados durante o dia
    await supabase
      .from("hourly_goal_blocks")
      .delete()
      .eq("plan_id", pid)
      .like("hour_label", "⏱%");

    // Zera os valores dos blocos originais
    await supabase
      .from("hourly_goal_blocks")
      .update({
        achieved_amount: 0,
        is_completed: false,
        timer_status: "idle",
        timer_started_at: null,
        valor_dinheiro: 0,
        valor_cartao: 0,
        valor_pix: 0,
        valor_calote: 0,
        valor_gorjeta: 0,
      })
      .eq("plan_id", pid);

    // Zera daily_sales do dia
    await supabase
      .from("daily_sales")
      .update({ cash_sales: 0, card_sales: 0, pix_sales: 0, tip_sales: 0, total_profit: 0, total_debt: 0 })
      .eq("user_id", userId)
      .eq("date", today);

    // Recarrega tudo do zero
    await loadData();
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
    workedMinutes,
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
    sessionSales,
    startChallenge,
    addSale,
    deleteSale,
    addLatePix,
    addTip,
    addApproach,
    addOccurrence,
    endChallenge,
    extendChallenge,
    restartChallenge,
    savePaymentBreakdown,
    startLunchPause,
    skipLunchPause,
    skipBreak,
    dismissBlockReport,
    quickSaleValue: blocks[currentBlockIndex]?.target_amount ?? 0,
  };
}

