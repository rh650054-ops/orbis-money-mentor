import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface TourStep {
  selector: string;
  route: string;
  title: string;
  text: string;
}

const tourSteps: TourStep[] = [
  {
    selector: '[data-tour="meta-dia"]',
    route: "/",
    title: "Sua missão do dia",
    text: "Essa é sua missão do dia. O Orbis calculou quanto você precisa vender hoje para bater sua meta mensal. Tudo começa aqui.",
  },
  {
    selector: '[data-tour="nav-ritmo"]',
    route: "/",
    title: "Ritmo de vendas",
    text: "Aqui é onde o trabalho acontece. Toque em Ritmo para acompanhar seu progresso hora a hora e ativar o DEFCON 4.",
  },
  {
    selector: '[data-tour="defcon-banner"]',
    route: "/daily-goals",
    title: "DEFCON 4 — Modo Desafio",
    text: "O DEFCON 4 é seu modo de foco máximo. Ative quando for para a rua. Blocos de 60 minutos, contador de abordagens e análise em tempo real.",
  },
  {
    selector: '[data-tour="nav-ranking"]',
    route: "/daily-goals",
    title: "Ranking de vendedores",
    text: "Veja onde você está entre os melhores vendedores. Cada real vendido sobe sua posição. Os Vision Points acumulados viram desconto real.",
  },
  {
    selector: '[data-tour="nav-rotina"]',
    route: "/daily-goals",
    title: "Sua rotina diária",
    text: "Configure sua rotina uma vez. Depois ela vira seu checklist diário — do momento que acorda até encerrar o dia no app.",
  },
];

interface GuidedTourProps {
  onComplete: () => void;
  onSkip: () => void;
  slideCount: number;
}

export default function GuidedTour({ onComplete, onSkip, slideCount }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [entering, setEntering] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const totalSteps = slideCount + tourSteps.length;
  const progress = ((slideCount + step + 1) / totalSteps) * 100;

  const currentStep = tourSteps[step];

  const measureElement = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.selector);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [currentStep]);

  // Navigate to the correct route for the current step
  useEffect(() => {
    if (!currentStep) return;
    if (location.pathname !== currentStep.route) {
      navigate(currentStep.route, { replace: true });
    }
  }, [currentStep, location.pathname, navigate]);

  // Measure element after route change and DOM paint
  useEffect(() => {
    const timer = setTimeout(measureElement, 400);
    window.addEventListener("resize", measureElement);
    window.addEventListener("scroll", measureElement);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measureElement);
      window.removeEventListener("scroll", measureElement);
    };
  }, [measureElement, step, location.pathname]);

  const handleNext = () => {
    if (step < tourSteps.length - 1) {
      setEntering(false);
      setTimeout(() => {
        setStep(step + 1);
        setEntering(true);
      }, 200);
    } else {
      onComplete();
    }
  };

  // If we're on the last step+1, show celebration
  if (step >= tourSteps.length) return null;

  const padding = 8;
  const highlightStyle = rect
    ? {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: 12,
      }
    : undefined;

  // Position tooltip below or above the highlighted element
  const tooltipBelow = rect ? rect.bottom + padding + 12 < window.innerHeight - 180 : true;

  return (
    <div className="fixed inset-0 z-[9998]">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-[10001] h-1 bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Skip button */}
      <button
        onClick={onSkip}
        className="fixed top-3 right-4 z-[10001] text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full border border-border/50 bg-background/80 backdrop-blur-sm"
      >
        Pular
      </button>

      {/* Dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {highlightStyle && (
              <rect
                x={highlightStyle.left}
                y={highlightStyle.top}
                width={highlightStyle.width}
                height={highlightStyle.height}
                rx={highlightStyle.borderRadius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.75)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: "all" }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Highlight ring */}
      {highlightStyle && (
        <div
          className="absolute border-2 border-primary/60 pointer-events-none transition-all duration-300"
          style={{
            ...highlightStyle,
            boxShadow: "0 0 0 4px hsl(var(--primary) / 0.15)",
          }}
        />
      )}

      {/* Tooltip card */}
      {rect && (
        <div
          className={cn(
            "fixed left-4 right-4 z-[10000] max-w-sm mx-auto transition-all duration-200",
            entering ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
          style={{
            top: tooltipBelow ? rect.bottom + padding + 16 : undefined,
            bottom: !tooltipBelow ? window.innerHeight - rect.top + padding + 16 : undefined,
          }}
        >
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-primary mb-2">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{currentStep.text}</p>
            <button
              onClick={handleNext}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform"
            >
              {step === tourSteps.length - 1 ? "Finalizar →" : "Entendi →"}
            </button>
          </div>
        </div>
      )}

      {/* Fallback if element not found */}
      {!rect && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center px-8">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xl max-w-sm w-full text-center">
            <h3 className="text-base font-bold text-primary mb-2">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">{currentStep.text}</p>
            <button
              onClick={handleNext}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform"
            >
              {step === tourSteps.length - 1 ? "Finalizar →" : "Entendi →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
