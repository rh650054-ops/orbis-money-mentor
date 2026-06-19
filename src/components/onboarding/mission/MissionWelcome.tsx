import { useState } from "react";
import { getCheckoutUrl } from "@/shared/lib/checkout";
import GoldParticles from "../GoldParticles";

interface MissionWelcomeProps {
  nickname?: string | null;
  onAdvance: () => void;
}

/**
 * Fase 1 da missão: boas-vindas + escolha (3 dias grátis / assinar).
 * A escolha fica INLINE na própria tela — sem abrir modal por cima — pra evitar
 * o "toque fantasma" (que ia direto pro checkout no celular) e travamentos de
 * clique no desktop. "Bora começar" começa o teste grátis; assinar é um toque
 * secundário, deliberado, que nunca é acionado por acidente.
 */
export default function MissionWelcome({ nickname, onAdvance }: MissionWelcomeProps) {
  const [busy, setBusy] = useState(false);
  const name = (nickname ?? "").trim() || "parceiro";

  const start = () => {
    if (busy) return;
    setBusy(true);
    onAdvance();
  };

  const subscribe = () => {
    if (busy) return;
    setBusy(true);
    window.open(getCheckoutUrl(), "_blank");
    onAdvance();
  };

  return (
    <div className="fixed inset-0 z-[9998] bg-background flex items-center justify-center px-8 animate-fade-in">
      <GoldParticles />
      <div className="relative flex flex-col items-center text-center max-w-xs w-full">
        <span className="text-7xl mb-6 block animate-scale-in">🔥</span>
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary/80 mb-2">
          Fase 1 de 2
        </p>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Bem-vindo ao Orbis, {name}!
        </h1>
        <p className="text-sm text-muted-foreground mb-7">
          Vamos preparar seu corre em poucos passos. Sua primeira missão começa agora.
        </p>

        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="w-full py-3.5 rounded-xl font-bold text-primary-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform disabled:opacity-70"
        >
          Bora começar →
        </button>

        <button
          type="button"
          onClick={subscribe}
          disabled={busy}
          className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-70"
        >
          Já quero assinar e garantir tudo
        </button>

        <p className="mt-4 text-[11px] text-muted-foreground/80">
          Você testa 3 dias grátis. Pode assinar quando quiser.
        </p>
      </div>
    </div>
  );
}
