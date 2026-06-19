import { useCallback, useMemo, useState } from "react";
import { missionSteps } from "./missionSteps";

// Chaves POR USUÁRIO (com user.id) — pra que a conclusão de UMA conta não "vaze"
// pra outra conta no mesmo navegador (era o bug do onboarding não aparecer em
// conta nova). Sem userId, cai nas chaves globais antigas (fallback).
const STEP_BASE = "orbis_onboarding_step";
const DONE_BASE = "orbis_mission_completed";
const stepKeyFor = (userId?: string) => (userId ? `${STEP_BASE}_${userId}` : STEP_BASE);
const doneKeyFor = (userId?: string) => (userId ? `${DONE_BASE}_${userId}` : DONE_BASE);

export interface MissionTourState {
  /** Índice do passo atual (0-based) em missionSteps. */
  index: number;
  /** True quando a missão foi concluída. */
  completed: boolean;
}

interface UseMissionTourArgs {
  /** ID do usuário — usado pra deixar o progresso/conclusão POR conta. */
  userId?: string;
  /** Passo inicial vindo do banco (cross-device). Default: localStorage. */
  initialIndex?: number;
  initialCompleted?: boolean;
  /** Chamado a cada mudança de passo — layout persiste no Supabase. */
  onStepChange?: (index: number) => void;
  /** Chamado quando a missão termina — layout marca onboarding_completed. */
  onComplete?: () => void;
}

function readInitialIndex(key: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(key);
  const n = raw == null ? 0 : Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(n, missionSteps.length - 1);
}

function readInitialCompleted(key: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(key) === "true";
}

export function useMissionTour(args: UseMissionTourArgs = {}) {
  const { userId, onStepChange, onComplete } = args;
  const stepKey = stepKeyFor(userId);
  const doneKey = doneKeyFor(userId);

  const [index, setIndex] = useState<number>(() =>
    Math.max(args.initialIndex ?? 0, readInitialIndex(stepKey)),
  );
  const [completed, setCompleted] = useState<boolean>(() =>
    args.initialCompleted ?? readInitialCompleted(doneKey),
  );

  const persistStep = useCallback(
    (next: number) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(stepKey, String(next));
      }
      onStepChange?.(next);
    },
    [onStepChange, stepKey],
  );

  const finish = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(doneKey, "true");
      window.localStorage.removeItem(stepKey);
    }
    setCompleted(true);
    onComplete?.();
  }, [onComplete, doneKey, stepKey]);

  const advance = useCallback(() => {
    setIndex((curr) => {
      const next = curr + 1;
      if (next >= missionSteps.length) {
        finish();
        return curr;
      }
      persistStep(next);
      return next;
    });
  }, [finish, persistStep]);

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(i, missionSteps.length - 1));
      persistStep(clamped);
      setIndex(clamped);
    },
    [persistStep],
  );

  /** Pular a missão inteira (botão "pular"). */
  const skipAll = useCallback(() => {
    finish();
  }, [finish]);

  /** Recomeçar do zero (botão "refazer tour" no Perfil). */
  const restart = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(doneKey);
      window.localStorage.setItem(stepKey, "0");
    }
    setCompleted(false);
    setIndex(0);
    onStepChange?.(0);
  }, [onStepChange, doneKey, stepKey]);

  const step = useMemo(() => missionSteps[index] ?? null, [index]);

  return { index, step, completed, advance, goTo, skipAll, restart };
}
