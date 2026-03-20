import { useState } from "react";
import { cn } from "@/lib/utils";

interface OnboardingSlidesProps {
  onComplete: () => void;
  onSkip: () => void;
}

const slides = [
  {
    emoji: "🚀",
    title: "Bem-vindo ao Orbis",
    subtitle: "O app feito por vendedor, para vendedor.",
    text: "Aqui você não vai só registrar vendas. Você vai dominar seu dia, bater suas metas e crescer de verdade.",
  },
  {
    emoji: "💸",
    title: "Chega de improvisar na rua",
    subtitle: "Você sabe quanto precisa vender agora?",
    text: "O Orbis divide sua meta em blocos de hora. Você sabe exatamente quanto precisa fazer em cada momento do dia — sem chute, sem ansiedade.",
  },
  {
    emoji: "⚡",
    title: "DEFCON 4 — Modo Foco Total",
    subtitle: "Blocos de 60 min. Sem distração. Só venda.",
    text: "Quando você ativar o DEFCON 4, o app conta seu tempo, suas abordagens e suas vendas em tempo real. No fim do bloco, você vê exatamente como foi.",
  },
  {
    emoji: "🏆",
    title: "Compita. Evolua. Seja recompensado.",
    subtitle: "Cada venda te aproxima do topo.",
    text: "O Ranking mostra os melhores vendedores do mês. Os Vision Points que você acumula viram desconto real na linha de produtos Orbis. Quanto mais você vende, mais você ganha.",
  },
  {
    emoji: "🔥",
    title: "Disciplina é o caminho",
    subtitle: "Sua rotina de campeão começa aqui.",
    text: "O Orbis monta sua rotina diária personalizada e te acompanha do momento que acorda até encerrar o dia. Hábito cria resultado.",
  },
];

export default function OnboardingSlides({ onComplete, onSkip }: OnboardingSlidesProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);

  const totalSteps = slides.length + 5; // 5 slides + 5 tour steps
  const progress = ((current + 1) / totalSteps) * 100;

  const goTo = (next: number) => {
    if (animating) return;
    setDirection(next > current ? "next" : "prev");
    setAnimating(true);
    setTimeout(() => {
      setCurrent(next);
      setAnimating(false);
    }, 300);
  };

  const handleNext = () => {
    if (current < slides.length - 1) {
      goTo(current + 1);
    } else {
      onComplete();
    }
  };

  const slide = slides[current];

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
      {/* Progress bar */}
      <div className="w-full h-1 bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute top-4 right-4 z-10 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full border border-border/50"
      >
        Pular
      </button>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
        <div
          key={current}
          className={cn(
            "flex flex-col items-center text-center max-w-sm",
            animating ? "animate-fade-out" : "animate-fade-in"
          )}
        >
          <span className="text-7xl mb-8 block" role="img">{slide.emoji}</span>
          <h1 className="text-2xl font-bold text-primary mb-3 leading-tight">{slide.title}</h1>
          <p className="text-lg text-foreground mb-4 leading-snug">{slide.subtitle}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{slide.text}</p>
        </div>
      </div>

      {/* Bottom: button + dots */}
      <div className="px-8 pb-10 flex flex-col items-center gap-6">
        <button
          onClick={handleNext}
          className="w-full max-w-xs py-3.5 rounded-xl font-semibold text-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform"
        >
          {current === slides.length - 1 ? "Começar tour →" : "Próximo →"}
        </button>

        {/* Dots */}
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                i === current ? "bg-primary w-6" : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
