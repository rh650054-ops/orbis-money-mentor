import { useState, useEffect } from "react";
import OnboardingSlides from "./OnboardingSlides";
import GuidedTour from "./GuidedTour";
import OnboardingCelebration from "./OnboardingCelebration";

const STORAGE_KEY = "orbis_onboarding_completed";
const SLIDE_COUNT = 5;

type Phase = "slides" | "tour" | "celebration" | "done";

export function useOnboarding() {
  const [phase, setPhase] = useState<Phase>(() => {
    return localStorage.getItem(STORAGE_KEY) === "true" ? "done" : "slides";
  });

  const markDone = () => {
    localStorage.setItem(STORAGE_KEY, "true");
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
        onComplete={() => setPhase("tour")}
        onSkip={markDone}
      />
    );
  }

  if (phase === "tour") {
    return (
      <GuidedTour
        slideCount={SLIDE_COUNT}
        onComplete={() => setPhase("celebration")}
        onSkip={markDone}
      />
    );
  }

  if (phase === "celebration") {
    return <OnboardingCelebration onDone={markDone} />;
  }

  return null;
}
