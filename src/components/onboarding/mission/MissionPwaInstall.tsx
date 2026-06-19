import { useState } from "react";

interface MissionPwaInstallProps {
  onAdvance: () => void;
}

type OS = "android" | "ios";

/**
 * Fase final da missão: tutorial opcional para instalar o Orbis como PWA.
 * Mostra os passos para Android (Chrome) e iPhone (Safari).
 * O usuário pode pular sem perder nada.
 */
export default function MissionPwaInstall({ onAdvance }: MissionPwaInstallProps) {
  const [os, setOs] = useState<OS>("android");

  const androidSteps = [
    { icon: "🌐", text: "Abra o Orbis no Chrome" },
    { icon: "⋮", text: 'Toque nos 3 pontinhos no canto superior direito' },
    { icon: "📲", text: '"Adicionar à tela inicial"' },
    { icon: "✅", text: "Confirme e pronto!" },
  ];

  const iosSteps = [
    { icon: "🧭", text: "Abra o Orbis no Safari" },
    { icon: "⬆️", text: "Toque no ícone de compartilhar (quadrado com seta)" },
    { icon: "➕", text: '"Adicionar à Tela de Início"' },
    { icon: "✅", text: "Confirme e pronto!" },
  ];

  const steps = os === "android" ? androidSteps : iosSteps;

  return (
    <div className="fixed inset-0 z-[10050] bg-background flex items-center justify-center px-6 animate-fade-in pointer-events-auto">
      <div className="flex flex-col items-center text-center max-w-xs w-full">
        {/* Ícone do app */}
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
            <span className="text-4xl">🔥</span>
          </div>
          {/* Simulação de home screen */}
          <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
            <span className="text-xs">✓</span>
          </div>
        </div>

        <h2 className="text-xl font-bold text-foreground mb-1">
          Instale o Orbis no celular
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          Fica igual um app de verdade — abre direto da tela inicial, sem precisar do navegador.
        </p>

        {/* Seletor Android / iPhone */}
        <div className="flex rounded-xl bg-muted p-1 mb-5 w-full">
          <button
            type="button"
            onClick={() => setOs("android")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              os === "android"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Android
          </button>
          <button
            type="button"
            onClick={() => setOs("ios")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              os === "ios"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            iPhone
          </button>
        </div>

        {/* Passos */}
        <div className="w-full space-y-3 mb-7">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-base">
                {step.icon}
              </div>
              <span className="text-sm text-foreground">{step.text}</span>
            </div>
          ))}
        </div>

        {/* Botões */}
        <button
          type="button"
          onClick={onAdvance}
          className="w-full py-3.5 rounded-xl font-bold text-primary-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform mb-3"
        >
          Entendido, vamos lá! 🚀
        </button>
        <button
          type="button"
          onClick={onAdvance}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Pular por agora
        </button>
      </div>
    </div>
  );
}
