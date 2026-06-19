import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import MissionTour from "./MissionTour";
import MissionWelcome from "./MissionWelcome";
import MissionRanking from "./MissionRanking";
import MissionReward from "./MissionReward";
import { useMissionTour } from "./useMissionTour";

interface MissionOrchestratorProps {
  userId: string;
  nickname?: string | null;
  /** Passo inicial vindo do banco (cross-device). */
  initialIndex?: number;
  /** Chamado quando a missão termina (layout esconde o overlay). */
  onCompleted?: () => void;
}

/**
 * Orquestra a Missão de Boas-Vindas: liga a máquina de passos (useMissionTour)
 * ao motor de coachmark (MissionTour) e persiste o progresso no Supabase
 * (profiles.onboarding_step / onboarding_completed) pra retomar cross-device.
 * Renderiza-se SOBRE o app real (overlay), não substitui o app.
 */
export default function MissionOrchestrator({
  userId,
  nickname,
  initialIndex,
  onCompleted,
}: MissionOrchestratorProps) {
  const persistStep = useCallback(
    (index: number) => {
      void supabase.from("profiles").update({ onboarding_step: index }).eq("user_id", userId);
    },
    [userId],
  );

  const persistDone = useCallback(() => {
    void supabase
      .from("profiles")
      .update({ onboarding_completed: true, onboarding_step: 0 })
      .eq("user_id", userId);
    onCompleted?.();
  }, [userId, onCompleted]);

  const { index, completed, advance, skipAll } = useMissionTour({
    userId,
    initialIndex,
    onStepChange: persistStep,
    onComplete: persistDone,
  });

  if (completed) return null;

  return (
    <MissionTour
      index={index}
      onAdvance={advance}
      onSkip={skipAll}
      renderSpecial={(special, controls) => {
        if (special === "card-registration") {
          return <MissionWelcome nickname={nickname} onAdvance={controls.onAdvance} />;
        }
        if (special === "ranking") {
          return <MissionRanking onAdvance={controls.onAdvance} />;
        }
        if (special === "reward") {
          return <MissionReward onAdvance={controls.onAdvance} />;
        }
        return null;
      }}
    />
  );
}
