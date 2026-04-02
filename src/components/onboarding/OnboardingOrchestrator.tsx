import { useState } from "react";
import OnboardingSlides from "./OnboardingSlides";
import MissionDay1Modal from "./MissionDay1Modal";

const STORAGE_KEY = "orbis_onboarding_completo";
const OLD_STORAGE_KEY = "orbis_onboarding_completed";

type Phase = "slides" | "mission" | "done";

export function useOnboarding() {
  const [phase, setPhase] = useState<Phase>(() => {
    return (localStorage.getItem(STORAGE_KEY) === "true" || localStorage.getItem(OLD_STORAGE_KEY) === "true") ? "done" : "slides";
  });

  const markDone = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    localStorage.setItem(OLD_STORAGE_KEY, "true");
    setPhase("done");
  };

  return { phase, setPhase, markDone };
}

interface Props {
  phase: Phase;
  setPhase: (p: Phase) => void;
  markDone: () => void;
}

export default function OnboardingOrchestrator({ phase, setPhase, markDone }: Props) {
  if (phase === "done") return null;

  if (phase === "slides") {
    return (
      <OnboardingSlides
        onComplete={() => setPhase("mission")}
        onSkip={markDone}
      />
    );
  }

  if (phase === "mission") {
    return <MissionDay1Modal onDone={markDone} />;
  }

  return null;
}
