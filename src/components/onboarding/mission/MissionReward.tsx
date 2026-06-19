import { useEffect } from "react";
import confetti from "canvas-confetti";
import { getTier } from "@/components/ranking/tier";
import { getCheckoutUrl } from "@/shared/lib/checkout";
import GoldParticles from "../GoldParticles";

interface MissionRewardProps {
  /** Encerra a missão (marca como concluída). */
  onAdvance: () => void;
}

const CHECKLIST = [
  "Meta do mês definida",
  "Mercadoria cadastrada",
  "Horário de corre configurado",
  "Primeira venda registrada",
];

/**
 * Fase 7 — Recompensa: confete, patente inicial (Bronze/Semente),
 * resumo do que foi configurado e CTA de assinar.
 */
export default function MissionReward({ onAdvance }: MissionRewardProps) {
  const tier = getTier(999); // posição baixa => BRONZE (patente inicial)

  useEffect(() => {
    const colors = ["#F2B43A", "#CD7F45", "#FFD700"];
    confetti({ particleCount: 90, spread: 80, startVelocity: 45, origin: { y: 0.6 }, colors });
    const t = window.setTimeout(() => {
      confetti({ particleCount: 50, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 50, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
    }, 250);
    return () => window.clearTimeout(t);
  }, []);

  const handleSubscribe = () => {
    window.open(getCheckoutUrl(), "_blank");
    onAdvance();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center px-8 animate-fade-in overflow-y-auto">
      <GoldParticles />
      <div className="relative flex flex-col items-center text-center max-w-xs py-8">
        <img
          src={tier.icon}
          alt={tier.label}
          className="w-24 h-24 object-contain mb-4 animate-scale-in"
          style={{ filter: `drop-shadow(0 0 16px ${tier.glow})` }}
        />
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary/80 mb-1">
          Patente desbloqueada
        </p>
        <h1 className="text-2xl font-bold text-primary mb-1">Missão cumprida! 🏆</h1>
        <p className="text-sm font-semibold text-foreground mb-1">{tier.label}</p>
        <p className="text-sm text-muted-foreground mb-6">
          Você fez o que a maioria não faz: começou. Agora é manter o ritmo.
        </p>

        <div className="w-full bg-card border border-border rounded-2xl p-4 mb-6 text-left">
          {CHECKLIST.map((item) => (
            <div key={item} className="flex items-center gap-2.5 py-1">
              <span className="text-success text-base">✓</span>
              <span className="text-sm text-foreground">{item}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onAdvance}
          className="w-full py-3.5 rounded-xl font-bold text-primary-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform mb-2"
        >
          Bora vender! →
        </button>
        <button
          onClick={handleSubscribe}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Assinar agora e garantir tudo
        </button>
      </div>
    </div>
  );
}
