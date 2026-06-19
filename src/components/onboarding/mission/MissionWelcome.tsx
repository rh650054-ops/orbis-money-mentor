import { useState } from "react";
import CardRegistrationModal from "@/components/CardRegistrationModal";
import GoldParticles from "../GoldParticles";

interface MissionWelcomeProps {
  nickname?: string | null;
  onAdvance: () => void;
}

/**
 * Fase 1 da missão: boas-vindas + escolha (assinar / 3 dias grátis).
 * Reusa o CardRegistrationModal; qualquer escolha avança a missão.
 */
export default function MissionWelcome({ nickname, onAdvance }: MissionWelcomeProps) {
  const [showCard, setShowCard] = useState(false);
  const name = (nickname ?? "").trim() || "parceiro";

  return (
    <>
      {!showCard && (
        <div className="fixed inset-0 z-[9998] bg-background flex items-center justify-center px-8 animate-fade-in">
          <GoldParticles />
          <div className="relative flex flex-col items-center text-center max-w-xs">
        <span className="text-7xl mb-6 block animate-scale-in">🔥</span>
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary/80 mb-2">
          Fase 1 de 2
        </p>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Bem-vindo ao Orbis, {name}!
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Vamos preparar seu corre em poucos passos. Sua primeira missão começa agora.
        </p>
            <button
              onClick={() => setShowCard(true)}
              className="w-full py-3.5 rounded-xl font-bold text-primary-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform"
            >
              Bora começar →
            </button>
          </div>
        </div>
      )}

      <CardRegistrationModal
        isOpen={showCard}
        onClose={() => {
          setShowCard(false);
          onAdvance();
        }}
      />
    </>
  );
}
