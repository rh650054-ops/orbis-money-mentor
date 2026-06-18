import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { getTier } from "./tier";

const UP_LINES = [
  "Você é fera! Subiu de liga. Agora é manter o ritmo.",
  "Subiu! O topo tá te chamando.",
  "Liga nova desbloqueada. Você merece — bora pra próxima!",
];
const DOWN_LINES = [
  "Caiu de liga, mas isso é temporário. Vendedor de verdade reage. Bora!",
  "Tropeçou? Levanta. O topo ainda é seu — volta com tudo.",
  "Rebaixado é só um aviso: hora de acelerar. Você consegue.",
];

interface Props {
  type: "up" | "down";
  position: number;
  onClose: () => void;
}

export function LeagueTransition({ type, position, onClose }: Props) {
  const tier = getTier(position);
  const up = type === "up";
  const lineRef = useRef((up ? UP_LINES : DOWN_LINES)[Math.floor(Math.random() * 3)]);
  const firedRef = useRef(false);

  useEffect(() => {
    if (up && !firedRef.current) {
      firedRef.current = true;
      const colors = [tier.color, "#ffffff", "#F5D77A"];
      const end = Date.now() + 1300;
      const tick = () => {
        confetti({ particleCount: 6, angle: 60, spread: 75, startVelocity: 45, origin: { x: 0, y: 0.7 }, colors });
        confetti({ particleCount: 6, angle: 120, spread: 75, startVelocity: 45, origin: { x: 1, y: 0.7 }, colors });
        if (Date.now() < end) requestAnimationFrame(tick);
      };
      tick();
    }
    const t = setTimeout(onClose, 6500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-sm orbis-fade-in"
      onClick={onClose}
    >
      <div className="text-center px-7 max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="text-[11px] tracking-[0.4em] mb-3" style={{ color: tier.color }}>
          {up ? "PROMOÇÃO DE LIGA" : "REBAIXAMENTO"}
        </p>
        <img
          src={tier.icon}
          alt={tier.label}
          className="w-40 h-40 object-contain mx-auto orbis-league-pop"
          style={{ filter: `drop-shadow(0 0 30px ${tier.glow})` }}
        />
        <h2 className="text-3xl font-black mt-2" style={{ color: tier.color, textShadow: `0 0 22px ${tier.glow}` }}>
          {tier.label}
        </h2>
        <p className="text-white/90 font-bold text-lg mt-1">
          {up ? "Você subiu de liga!" : "Você caiu de liga"}
        </p>
        <p className="text-muted-foreground text-sm mt-2 leading-snug">{lineRef.current}</p>
        <button
          onClick={onClose}
          className="mt-6 inline-flex items-center justify-center font-black text-sm px-8 py-3 rounded-xl active:scale-[0.97] transition-transform"
          style={{ background: tier.color, color: "#0a0a0d" }}
        >
          {up ? "BORA! 🚀" : "VOU REAGIR 💪"}
        </button>
      </div>
    </div>
  );
}
