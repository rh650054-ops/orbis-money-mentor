import { useState } from "react";
import { cn } from "@/lib/utils";

interface OnboardingSlidesProps {
  onComplete: () => void;
  onSkip: () => void;
}

const profileOptions = [
  {
    id: "A",
    emoji: "🔥",
    text: "Sei vender mas perco o foco\ne a constância no dia a dia",
  },
  {
    id: "B",
    emoji: "🧭",
    text: "Me esforço muito mas não sei\nse estou no caminho certo",
  },
  {
    id: "C",
    emoji: "📊",
    text: "Vendo razoável mas não entendo\nos números do meu negócio",
  },
];

const profileReveals: Record<string, {
  emoji: string;
  title: string;
  text: string;
  features: { icon: string; text: string }[];
}> = {
  A: {
    emoji: "🔥",
    title: "Vendedor Experiente",
    text: "Você sabe vender. O problema não é habilidade — é consistência. Sem estrutura, os bons dias ficam isolados. O Orbis vai transformar seu talento em resultado todo dia.",
    features: [
      { icon: "⚡", text: "DEFCON 4 — Blocos de foco. Sem distração." },
      { icon: "🏆", text: "Ranking — Compita. Seja o melhor do mês." },
      { icon: "🔥", text: "Constância — Seu streak de dias consecutivos." },
      { icon: "💎", text: "Vision Points — Cada dia vira recompensa real." },
    ],
  },
  B: {
    emoji: "🧭",
    title: "Vendedor com Garra",
    text: "Você tem energia e vontade de sobra. O que falta é método — saber exatamente o que fazer a cada hora. O Orbis vai transformar seu esforço em resultado previsível.",
    features: [
      { icon: "⚡", text: "DEFCON 4 — Meta dividida em blocos de 1 hora." },
      { icon: "🎯", text: "Meta de Abordagens — Quantas pessoas falar." },
      { icon: "🧠", text: "Rotina Coach — Sua rotina ideal gerada pelo app." },
      { icon: "🤖", text: "IA Diária — Dicas personalizadas no fim do dia." },
    ],
  },
  C: {
    emoji: "📊",
    title: "Vendedor Completo",
    text: "Você já tem habilidade e motivação. O que falta é visibilidade — entender profundamente os números do seu negócio. O Orbis vai transformar sua intuição em dados.",
    features: [
      { icon: "📊", text: "Dashboard — Lucro e evolução em tempo real." },
      { icon: "🤖", text: "Relatório IA — Análise do seu dia." },
      { icon: "⚡", text: "DEFCON 4 — Performance hora a hora." },
      { icon: "🏆", text: "Ranking — Veja onde você está." },
    ],
  },
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function OnboardingSlides({ onComplete, onSkip }: OnboardingSlidesProps) {
  const [screen, setScreen] = useState(1);
  const [profile, setProfile] = useState("");
  const [nome, setNome] = useState("");
  const [meta, setMeta] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [animating, setAnimating] = useState(false);

  const totalScreens = 5;
  const progress = (screen / totalScreens) * 100;

  const goTo = (next: number) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setScreen(next);
      setAnimating(false);
    }, 300);
  };

  const handleProfileSelect = (id: string) => {
    localStorage.setItem("orbis_perfil", id);
    setProfile(id);
    goTo(3);
  };

  const handleConfigSubmit = () => {
    if (!nome.trim() || !meta.trim()) return;
    localStorage.setItem("orbis_nome", nome.trim());
    localStorage.setItem("orbis_meta", meta);
    if (whatsapp) localStorage.setItem("orbis_whatsapp", whatsapp.replace(/\D/g, ""));
    const metaDiaria = (parseFloat(meta) / 22).toFixed(2);
    localStorage.setItem("orbis_meta_diaria", metaDiaria);
    goTo(5);
  };

  const handleFinish = () => {
    localStorage.setItem("orbis_onboarding_completo", "true");
    // Also set the old key for backwards compatibility
    localStorage.setItem("orbis_onboarding_completed", "true");
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem("orbis_onboarding_completo", "true");
    localStorage.setItem("orbis_onboarding_completed", "true");
    onSkip();
  };

  const storedNome = localStorage.getItem("orbis_nome") || nome;
  const reveal = profileReveals[profile] || profileReveals["A"];

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0D0D0D] flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="w-full h-1 bg-[#1A1A1A]">
        <div
          className="h-full bg-[#F4A100] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 z-10 text-xs text-[#888888] hover:text-white transition-colors px-3 py-1.5 rounded-full border border-[#333333]"
      >
        Pular
      </button>

      {/* Content */}
      <div
        className={cn(
          "flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto",
          animating ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0",
          "transition-all duration-300"
        )}
      >
        {/* TELA 1 — BOAS-VINDAS */}
        {screen === 1 && (
          <div className="flex flex-col items-center text-center max-w-sm w-full gap-6">
            <h1 className="text-[48px] font-bold text-[#F4A100] tracking-tight">ORBIS</h1>
            <p className="text-[22px] font-bold text-white leading-tight">
              O app feito por vendedor,{"\n"}para vendedor.
            </p>
            <p className="text-[16px] text-[#888888] italic leading-relaxed">
              Criado por quem vendeu na rua, tomou calote e precisava de controle. Cada funcionalidade resolve uma dor real.
            </p>
            <div className="w-full mt-8">
              <button
                onClick={() => goTo(2)}
                className="w-full py-4 rounded-xl font-bold text-black bg-[#F4A100] text-lg active:scale-[0.97] transition-transform"
              >
                Começar
              </button>
            </div>
          </div>
        )}

        {/* TELA 2 — PERGUNTA DO PERFIL */}
        {screen === 2 && (
          <div className="flex flex-col items-center text-center max-w-sm w-full gap-6">
            {/* Dots */}
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full",
                    i <= 1 ? "bg-[#F4A100]" : "bg-[#333333]"
                  )}
                />
              ))}
            </div>

            <h2 className="text-[24px] font-bold text-white leading-tight">
              Qual é sua maior dor vendendo na rua?
            </h2>

            <div className="w-full space-y-3">
              {profileOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleProfileSelect(opt.id)}
                  className="w-full p-5 rounded-xl bg-[#1A1A1A] border border-[#333333] text-left active:scale-[0.98] transition-transform hover:border-[#F4A100]/50"
                >
                  <span className="text-2xl mb-2 block">{opt.emoji}</span>
                  <p className="text-white text-[15px] whitespace-pre-line leading-relaxed">{opt.text}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TELA 3 — REVELAÇÃO DO PERFIL */}
        {screen === 3 && (
          <div className="flex flex-col items-center text-center max-w-sm w-full gap-5">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={cn("w-3 h-3 rounded-full", i <= 2 ? "bg-[#F4A100]" : "bg-[#333333]")} />
              ))}
            </div>

            <span className="text-6xl">{reveal.emoji}</span>
            <h2 className="text-[28px] font-bold text-[#F4A100]">{reveal.title}</h2>
            <p className="text-[15px] text-[#888888] leading-relaxed">{reveal.text}</p>

            <div className="w-full bg-[#1A1A1A] border border-[#333333] rounded-xl p-5 text-left space-y-3">
              <p className="text-sm font-bold text-white">Seu plano no Orbis:</p>
              {reveal.features.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-lg">{f.icon}</span>
                  <p className="text-sm text-[#888888]">{f.text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => goTo(4)}
              className="w-full py-4 rounded-xl font-bold text-black bg-[#F4A100] text-lg active:scale-[0.97] transition-transform mt-2"
            >
              Esse sou eu — continuar
            </button>
          </div>
        )}

        {/* TELA 4 — CONFIGURAÇÃO INICIAL */}
        {screen === 4 && (
          <div className="flex flex-col items-center text-center max-w-sm w-full gap-5">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={cn("w-3 h-3 rounded-full", i <= 3 ? "bg-[#F4A100]" : "bg-[#333333]")} />
              ))}
            </div>

            <h2 className="text-[22px] font-bold text-white">Agora vamos configurar seu Orbis</h2>
            <p className="text-sm text-[#888888]">3 informações. Menos de 1 minuto.</p>

            <div className="w-full space-y-4 text-left">
              <div>
                <label className="text-sm text-white font-medium mb-1 block">Seu nome</label>
                <input
                  type="text"
                  placeholder="Como quer ser chamado?"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333333] text-white rounded-[10px] px-4 py-4 text-base placeholder:text-[#666] focus:outline-none focus:border-[#F4A100]"
                />
              </div>
              <div>
                <label className="text-sm text-white font-medium mb-1 block">Quanto quer ganhar por mês? (R$)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex: 3000"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333333] text-white rounded-[10px] px-4 py-4 text-base placeholder:text-[#666] focus:outline-none focus:border-[#F4A100]"
                />
              </div>
              <div>
                <label className="text-sm text-white font-medium mb-1 block">Seu WhatsApp (opcional)</label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="(11) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                  className="w-full bg-[#1A1A1A] border border-[#333333] text-white rounded-[10px] px-4 py-4 text-base placeholder:text-[#666] focus:outline-none focus:border-[#F4A100]"
                />
                <p className="text-xs text-[#888888] mt-1">Vou te enviar dicas personalizadas nos seus primeiros dias.</p>
              </div>
            </div>

            <button
              onClick={handleConfigSubmit}
              disabled={!nome.trim() || !meta.trim()}
              className="w-full py-4 rounded-xl font-bold text-black bg-[#F4A100] text-lg active:scale-[0.97] transition-transform disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              Configurar meu Orbis
            </button>
          </div>
        )}

        {/* TELA 5 — INSTALAR PWA */}
        {screen === 5 && (
          <div className="flex flex-col items-center text-center max-w-sm w-full gap-5">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-3 h-3 rounded-full bg-[#F4A100]" />
              ))}
            </div>

            <h2 className="text-[22px] font-bold text-white">
              Último passo, {storedNome || "Vendedor"}!
            </h2>
            <p className="text-[15px] text-[#888888]">
              Salva o Orbis no seu celular. Você vai precisar dele todo dia.
            </p>

            <div className="w-full space-y-3">
              <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 text-left">
                <p className="text-sm font-bold text-white mb-1">📱 iPhone</p>
                <p className="text-sm text-[#888888]">
                  Toque em Compartilhar → Adicionar à Tela de Início
                </p>
              </div>
              <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 text-left">
                <p className="text-sm font-bold text-white mb-1">🤖 Android</p>
                <p className="text-sm text-[#888888]">
                  Toque nos 3 pontos → Adicionar à tela inicial
                </p>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-4 rounded-xl font-bold text-black bg-[#F4A100] text-lg active:scale-[0.97] transition-transform mt-4"
            >
              Já salvei — entrar no Orbis 🚀
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
