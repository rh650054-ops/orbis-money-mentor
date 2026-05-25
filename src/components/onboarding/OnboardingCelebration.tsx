import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  onDone: () => void;
}

export default function OnboardingCelebration({ onDone }: Props) {
  const navigate = useNavigate();

  const handleStart = () => {
    onDone();
    navigate("/profile", { replace: true });
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleStart();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background flex items-center justify-center px-8 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-celebration-title"
    >
      <div className="flex flex-col items-center text-center max-w-xs">
        <span className="text-8xl mb-6 block animate-scale-in">🚀</span>
        <h1 id="onboarding-celebration-title" className="text-2xl font-bold text-primary mb-2">Você está pronto.</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Agora configure sua primeira meta e comece a dominar seu dia.
        </p>
        <button
          onClick={handleStart}
          className="w-full py-3.5 rounded-xl font-semibold text-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform"
        >
          Configurar minha meta →
        </button>
      </div>
    </div>
  );
}
