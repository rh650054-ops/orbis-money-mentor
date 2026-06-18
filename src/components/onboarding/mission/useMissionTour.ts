import { useCallback, useMemo, useState } from "react";
import { missionSteps } from "./missionSteps";

const STEP_KEY = "orbis_onboarding_step";
const DONE_KEY = "orbis_onboarding_completo";
const OLD_DONE_KEY = "orbis_onboarding_completed";

export interface MissionTourState {
  /** Índice do passo atual (0-based) em missionSteps. */
  index: number;
  /** True quando a missão foi concluída. */
  completed: boolean;
}

interface UseMissionTourArgs {
  /** Passo inicial vindo do banco (cross-device). Default: localStorage. */
  initialIndex?: number;
  initialCompleted?: boolean;
  /** Chamado a cada mudança de passo — layout persiste no Supabase. */
  onStepChange?: (index: number) => void;
  /** Chamado quando a missão termina — layout marca onboarding_completed. */
  onComplete?: () => void;
}

function readInitialIndex(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(STEP_KEY);
  const n = raw == null ? 0 : Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(n, missionSteps.length - 1);
}

function readInitialCompleted(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(DONE_KEY) === "true" ||
    window.localStorage.getItem(OLD_DONE_KEY) === "true"
  );
}

export function useMissionTour(args: UseMissionTourArgs = {}) {
  const { onStepChange, onComplete } = args;

  const [index, setIndex] = useState<number>(() =>
    args.initialIndex ?? readInitialIndex(),
  );
  const [completed, setCompleted] = useState<boolean>(() =>
    args.initialCompleted ?? readInitialCompleted(),
  );

  const persistStep = useCallback(
    (next: number) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STEP_KEY, String(next));
      }
      onStepChange?.(next);
    },
    [onStepChange],
  );

  const finish = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DONE_KEY, "true");
      window.localStorage.setItem(OLD_DONE_KEY, "true");
      window.localStorage.removeItem(STEP_KEY);
    }
    setCompleted(true);
    onComplete?.();
  }, [onComplete]);

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
      window.localStorage.removeItem(DONE_KEY);
      window.localStorage.removeItem(OLD_DONE_KEY);
      window.localStorage.setItem(STEP_KEY, "0");
    }
    setCompleted(false);
    setIndex(0);
    onStepChange?.(0);
  }, [onStepChange]);

  const step = useMemo(() => missionSteps[index] ?? null, [index]);

  return { index, step, completed, advance, goTo, skipAll, restart };
}
