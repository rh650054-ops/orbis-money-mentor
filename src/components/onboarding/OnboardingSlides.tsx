import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import GoldParticles from "./GoldParticles";

interface OnboardingSlidesProps {
  onComplete: () => void;
  onSkip: () => void;
}

const profileOptions = [
  { id: "A", emoji: "🔥", title: "Sei vender mas perco o foco", subtitle: "e a constância no dia a dia" },
  { id: "B", emoji: "🧭", title: "Me esforço muito mas não sei", subtitle: "se estou no caminho certo" },
  { id: "C", emoji: "📊", title: "Vendo razoável mas não entendo", subtitle: "os números do meu negócio" },
];

const profileReveals: Record<string, {
  emoji: string; title: string; text: string;
  features: { icon: string; text: string }[];
}> = {
  A: {
    emoji: "🔥", title: "Vendedor Experiente",
    text: "Você sabe vender. O problema não é habilidade — é consistência. Sem estrutura, os bons dias ficam isolados. O Orbis vai transformar seu talento em resultado todo dia.",
    features: [
      { icon: "⚡", text: "DEFCON 4 — Blocos de foco. Sem distração." },
      { icon: "🏆", text: "Ranking — Compita. Seja o melhor do mês." },
      { icon: "🔥", text: "Constância — Seu streak de dias consecutivos." },
      { icon: "💎", text: "Vision Points — Cada dia vira recompensa." },
    ],
  },
  B: {
    emoji: "🧭", title: "Vendedor com Garra",
    text: "Você tem energia e vontade de sobra. O que falta é método — saber exatamente o que fazer a cada hora. O Orbis vai transformar seu esforço em resultado previsível.",
    features: [
      { icon: "⚡", text: "DEFCON 4 — Meta dividida em blocos de 1 hora." },
      { icon: "🎯", text: "Meta de Abordagens — Quantas pessoas falar." },
      { icon: "🧠", text: "Rotina Coach — Sua rotina ideal gerada pelo app." },
      { icon: "🤖", text: "IA Diária — Dicas personalizadas no fim do dia." },
    ],
  },
  C: {
    emoji: "📊", title: "Vendedor Completo",
    text: "Você já tem habilidade e motivação. O que falta é visibilidade — entender os números do seu negócio. O Orbis vai transformar sua intuição em dados reais.",
    features: [
      { icon: "📊", text: "Dashboard — Lucro e evolução em tempo real." },
      { icon: "🤖", text: "Relatório IA — Análise do seu dia." },
      { icon: "⚡", text: "DEFCON 4 — Performance hora a hora." },
      { icon: "🏆", text: "Ranking — Veja onde você está." },
    ],
  },
};

const WEEK_DAYS = [
  { key: "sunday", label: "Dom" },
  { key: "monday", label: "Seg" },
  { key: "tuesday", label: "Ter" },
  { key: "wednesday", label: "Qua" },
  { key: "thursday", label: "Qui" },
  { key: "friday", label: "Sex" },
  { key: "saturday", label: "Sáb" },
];

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Shared styles
const goldGradient = "linear-gradient(135deg, #C9A84C, #F5D78E)";
const cardBg = "rgba(255,255,255,0.04)";
const cardBorder = "rgba(201,168,76,0.25)";
const cardBorderActive = "rgba(201,168,76,0.8)";
const cardBgActive = "rgba(201,168,76,0.08)";

function GoldButton({ children, onClick, disabled, className }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full py-4 rounded-[14px] font-bold text-black text-lg transition-all active:scale-[0.97]",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
      style={{
        background: goldGradient,
        boxShadow: "0 0 20px rgba(201,168,76,0.4)",
      }}
    >
      {children}
    </button>
  );
}

function GoldSeparator() {
  return (
    <div className="w-full h-px my-4" style={{
      background: "linear-gradient(90deg, transparent, #C9A84C, transparent)"
    }} />
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full px-6 pt-4">
      <div className="h-[2px] w-full rounded-full" style={{ background: "rgba(201,168,76,0.2)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress}%`, background: goldGradient }}
        />
      </div>
    </div>
  );
}

export default function OnboardingSlides({ onComplete, onSkip }: OnboardingSlidesProps) {
  const [screen, setScreen] = useState(1);
  const [profile, setProfile] = useState("");
  const [nome, setNome] = useState("");
  const [meta, setMeta] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [animating, setAnimating] = useState(false);
  const [validationError, setValidationError] = useState(false);

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
    setTimeout(() => goTo(3), 300);
  };

  // Calculated goals
  const metaNum = parseFloat(meta) || 0;
  const diasSemana = selectedDays.length;
  const metaDiaria = diasSemana > 0 ? metaNum / (diasSemana * 4.3) : 0;
  const metaSemanal = metaDiaria * diasSemana;
  const metaHora = hoursPerDay > 0 ? metaDiaria / hoursPerDay : 0;

  const handleConfigSubmit = async () => {
    if (!nome.trim() || !meta.trim()) {
      setValidationError(true);
      setTimeout(() => setValidationError(false), 1000);
      return;
    }

    // Save to localStorage
    localStorage.setItem("orbis_nome", nome.trim());
    localStorage.setItem("orbis_meta", meta);
    localStorage.setItem("orbis_dias_semana", String(diasSemana));
    localStorage.setItem("orbis_horas_dia", String(hoursPerDay));
    localStorage.setItem("orbis_meta_diaria", metaDiaria.toFixed(2));
    localStorage.setItem("orbis_meta_hora", metaHora.toFixed(2));
    localStorage.setItem("orbis_meta_semanal", metaSemanal.toFixed(2));
    if (whatsapp) localStorage.setItem("orbis_whatsapp", whatsapp.replace(/\D/g, ""));

    // Save to database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({
          nickname: nome.trim(),
          monthly_goal: metaNum,
          base_daily_goal: Math.round(metaDiaria * 100) / 100,
          weekly_goal: Math.round(metaSemanal * 100) / 100,
          weekly_work_days: diasSemana,
          goal_hours: hoursPerDay,
          working_days: selectedDays,
          phone: whatsapp ? whatsapp.replace(/\D/g, "") : null,
        }).eq("user_id", user.id);
      }
    } catch (e) {
      console.error("Error saving profile:", e);
    }

    goTo(5);
  };

  const handleFinish = () => {
    localStorage.setItem("orbis_onboarding_completo", "true");
    localStorage.setItem("orbis_onboarding_completed", "true");
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem("orbis_onboarding_completo", "true");
    localStorage.setItem("orbis_onboarding_completed", "true");
    onSkip();
  };

  const reveal = profileReveals[profile] || profileReveals["A"];

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden" style={{ background: "#000" }}>
      <GoldParticles />

      {/* Progress bar */}
      <ProgressBar progress={progress} />

      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 z-10 text-xs px-3 py-1.5 rounded-full transition-colors"
        style={{ color: "#888", border: "1px solid rgba(201,168,76,0.2)" }}
      >
        Pular
      </button>

      {/* Content */}
      <div
        className={cn(
          "flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto relative z-10",
          animating ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0",
          "transition-all duration-300"
        )}
      >
        {/* TELA 1 — BOAS-VINDAS */}
        {screen === 1 && (
          <div className="flex flex-col items-center text-center max-w-sm w-full gap-6">
            <div>
              <h1
                className="text-[52px] font-bold"
                style={{
                  background: goldGradient,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "8px",
                }}
              >
                ORBIS
              </h1>
              <div className="mx-auto mt-2" style={{ width: 60, height: 1, background: goldGradient }} />
            </div>

            <p className="text-[22px] font-bold text-white" style={{ letterSpacing: "1px" }}>
              O app feito por vendedor,{"\n"}para vendedor.
            </p>

            <GoldSeparator />

            <p className="text-[15px] italic leading-[1.7]" style={{ color: "#888" }}>
              Criado por quem vendeu na rua, tomou calote e precisava de controle.
              Cada funcionalidade resolve uma dor real.
            </p>

            <div className="w-full mt-8">
              <GoldButton onClick={() => goTo(2)}>Começar</GoldButton>
            </div>
          </div>
        )}

        {/* TELA 2 — PERGUNTA DO PERFIL */}
        {screen === 2 && (
          <div className="flex flex-col items-center text-center max-w-sm w-full gap-6">
            <p className="text-[11px] font-medium" style={{ color: "#C9A84C", letterSpacing: "3px" }}>
              IDENTIFIQUE SEU PERFIL
            </p>

            <h2 className="text-[26px] font-bold text-white" style={{ letterSpacing: "1px" }}>
              Qual é sua maior dor{"\n"}vendendo na rua?
            </h2>

            <div className="w-full space-y-3">
              {profileOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleProfileSelect(opt.id)}
                  className="w-full p-5 rounded-[16px] text-left flex items-center gap-4 active:scale-[0.98] transition-all duration-200"
                  style={{
                    background: cardBg,
                    border: `1px solid ${cardBorder}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.border = `1px solid ${cardBorderActive}`;
                    e.currentTarget.style.background = cardBgActive;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.border = `1px solid ${cardBorder}`;
                    e.currentTarget.style.background = cardBg;
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-full shrink-0"
                    style={{
                      width: 44, height: 44,
                      background: "rgba(201,168,76,0.15)",
                    }}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-[16px]">{opt.title}</p>
                    <p className="text-[14px]" style={{ color: "#888" }}>{opt.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TELA 3 — REVELAÇÃO DO PERFIL */}
        {screen === 3 && (
          <div className="flex flex-col items-center text-center max-w-sm w-full gap-5 animate-scale-in">
            <p className="text-[11px] font-medium" style={{ color: "#C9A84C", letterSpacing: "3px" }}>
              SEU PERFIL
            </p>

            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 80, height: 80,
                border: "2px solid #C9A84C",
                boxShadow: "0 0 30px rgba(201,168,76,0.3)",
                animation: "pulse 2s ease-in-out infinite",
              }}
            >
              <span className="text-5xl">{reveal.emoji}</span>
            </div>

            <h2
              className="text-[30px] font-bold"
              style={{
                background: goldGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {reveal.title}
            </h2>

            <div className="mx-auto" style={{ width: 60, height: 1, background: goldGradient }} />

            <p className="text-[15px] leading-[1.7]" style={{ color: "#888" }}>
              {reveal.text}
            </p>

            <div
              className="w-full rounded-[16px] p-5 text-left space-y-3"
              style={{
                background: "rgba(201,168,76,0.06)",
                border: "1px solid rgba(201,168,76,0.3)",
              }}
            >
              <p className="text-sm font-bold text-white" style={{ letterSpacing: "1px" }}>
                Seu plano no Orbis:
              </p>
              {reveal.features.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span
                    className="flex items-center justify-center rounded-full shrink-0 text-sm"
                    style={{ width: 28, height: 28, background: "rgba(201,168,76,0.15)" }}
                  >
                    {f.icon}
                  </span>
                  <p className="text-sm" style={{ color: "#aaa" }}>{f.text}</p>
                </div>
              ))}
            </div>

            <GoldButton onClick={() => goTo(4)}>Esse sou eu — continuar</GoldButton>
          </div>
        )}

        {/* TELA 4 — CONFIGURAR METAS */}
        {screen === 4 && (
          <div className="flex flex-col items-center text-center max-w-sm w-full gap-4 pb-8">
            <p className="text-[11px] font-medium" style={{ color: "#C9A84C", letterSpacing: "3px" }}>
              CONFIGURE SUAS METAS
            </p>
            <h2 className="text-[24px] font-bold text-white" style={{ letterSpacing: "1px" }}>
              Agora vamos configurar{"\n"}seu Orbis
            </h2>
            <p className="text-[14px]" style={{ color: "#888" }}>Menos de 1 minuto.</p>

            <div className="w-full space-y-4 text-left">
              {/* Nome */}
              <div>
                <label className="text-sm text-white font-medium mb-1.5 block" style={{ letterSpacing: "0.5px" }}>
                  Seu nome
                </label>
                <input
                  type="text"
                  placeholder="Como quer ser chamado?"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full text-white text-base placeholder:text-[#555] focus:outline-none transition-all"
                  style={{
                    background: cardBg,
                    border: `1px solid ${validationError && !nome.trim() ? "rgba(239,68,68,0.7)" : cardBorder}`,
                    borderRadius: 12, padding: 18,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.7)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = cardBorder; }}
                />
              </div>

              {/* Meta mensal */}
              <div>
                <label className="text-sm text-white font-medium mb-1.5 block">Meta mensal (R$)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex: 3000"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                  className="w-full text-white text-base placeholder:text-[#555] focus:outline-none transition-all"
                  style={{
                    background: cardBg,
                    border: `1px solid ${validationError && !meta.trim() ? "rgba(239,68,68,0.7)" : cardBorder}`,
                    borderRadius: 12, padding: 18,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.7)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = cardBorder; }}
                />
              </div>

              {/* Dias da semana */}
              <div>
                <label className="text-sm text-white font-medium mb-1.5 block">Dias de trabalho por semana</label>
                <div className="flex gap-2 justify-between">
                  {WEEK_DAYS.map((d) => {
                    const active = selectedDays.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        onClick={() => setSelectedDays(prev =>
                          active ? prev.filter(k => k !== d.key) : [...prev, d.key]
                        )}
                        className="flex-1 py-2.5 rounded-full text-xs font-bold transition-all"
                        style={{
                          background: active ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${active ? "rgba(201,168,76,0.8)" : "rgba(201,168,76,0.15)"}`,
                          color: active ? "#F5D78E" : "#666",
                        }}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horas por dia */}
              <div>
                <label className="text-sm text-white font-medium mb-1.5 block">Horas de trabalho por dia</label>
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={() => setHoursPerDay(Math.max(1, hoursPerDay - 1))}
                    className="w-12 h-12 rounded-full text-xl font-bold transition-all"
                    style={{
                      background: cardBg, border: `1px solid ${cardBorder}`, color: "#C9A84C",
                    }}
                  >
                    −
                  </button>
                  <span className="text-3xl font-bold text-white min-w-[48px] text-center">{hoursPerDay}</span>
                  <button
                    onClick={() => setHoursPerDay(Math.min(16, hoursPerDay + 1))}
                    className="w-12 h-12 rounded-full text-xl font-bold transition-all"
                    style={{
                      background: cardBg, border: `1px solid ${cardBorder}`, color: "#C9A84C",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Resumo calculado */}
              {metaNum > 0 && diasSemana > 0 && (
                <div
                  className="rounded-[16px] p-4 grid grid-cols-3 gap-3 text-center"
                  style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.3)" }}
                >
                  <div>
                    <p className="text-[11px] mb-1" style={{ color: "#888" }}>Semanal</p>
                    <p className="text-sm font-bold" style={{ color: "#4ade80" }}>
                      R${metaSemanal.toFixed(0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] mb-1" style={{ color: "#888" }}>Diária</p>
                    <p className="text-sm font-bold" style={{ color: "#60a5fa" }}>
                      R${metaDiaria.toFixed(0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] mb-1" style={{ color: "#888" }}>Por Hora</p>
                    <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>
                      R${metaHora.toFixed(0)}
                    </p>
                  </div>
                </div>
              )}

              {/* WhatsApp */}
              <div>
                <label className="text-sm text-white font-medium mb-1.5 block">Seu WhatsApp (opcional)</label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="(11) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                  className="w-full text-white text-base placeholder:text-[#555] focus:outline-none transition-all"
                  style={{
                    background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, padding: 18,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.7)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = cardBorder; }}
                />
                <p className="text-xs mt-1.5" style={{ color: "#555" }}>
                  Vou te enviar dicas personalizadas nos seus primeiros dias.
                </p>
              </div>
            </div>

            <div className="w-full mt-2">
              <GoldButton onClick={handleConfigSubmit} disabled={!nome.trim() || !meta.trim()}>
                Configurar meu Orbis
              </GoldButton>
            </div>
          </div>
        )}

        {/* TELA 5 — INSTALAR PWA */}
        {screen === 5 && (
          <div className="flex flex-col items-center text-center max-w-sm w-full gap-5">
            <p className="text-[11px] font-medium" style={{ color: "#C9A84C", letterSpacing: "3px" }}>
              ÚLTIMO PASSO
            </p>

            <h2 className="text-[28px] font-bold">
              <span style={{
                background: goldGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                Salva o Orbis,{"\n"}{nome || "Vendedor"}
              </span>
            </h2>

            <p className="text-[15px]" style={{ color: "#888" }}>
              Você vai precisar dele todo dia.{"\n"}Ele precisa estar a 1 toque de distância.
            </p>

            <div className="w-full space-y-3">
              <div
                className="rounded-[16px] p-5 text-left flex items-center gap-4"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 44, height: 44, background: "rgba(201,168,76,0.15)" }}
                >
                  <span className="text-2xl">📱</span>
                </div>
                <div>
                  <p className="text-white font-bold">iPhone</p>
                  <p className="text-sm" style={{ color: "#888" }}>
                    Toque em Compartilhar → Adicionar à Tela de Início
                  </p>
                </div>
              </div>

              <div
                className="rounded-[16px] p-5 text-left flex items-center gap-4"
                style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
              >
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 44, height: 44, background: "rgba(201,168,76,0.15)" }}
                >
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <p className="text-white font-bold">Android</p>
                  <p className="text-sm" style={{ color: "#888" }}>
                    Toque nos 3 pontos → Adicionar à tela inicial
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full mt-4">
              <GoldButton
                onClick={handleFinish}
                className="animate-pulse"
              >
                Já salvei — entrar no Orbis 🚀
              </GoldButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
