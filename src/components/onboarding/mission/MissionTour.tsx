import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/shared/lib/utils";
import { onMissionEvent } from "@/shared/lib/missionEvents";
import { missionSteps, TOTAL_PHASES, type MissionSpecial } from "./missionSteps";

interface SpecialControls {
  onAdvance: () => void;
  onSkip: () => void;
}

interface MissionTourProps {
  index: number;
  onAdvance: () => void;
  onSkip: () => void;
  /** Renderiza passos especiais (fase 0 assinatura, fase final recompensa). */
  renderSpecial?: (special: MissionSpecial, controls: SpecialControls) => ReactNode;
}

const PAD = 8; // padding do furo ao redor do alvo

/**
 * Motor da Missão de Boas-Vindas: overlay de coachmark sobre o app REAL.
 * - Escurece a tela com um "furo" recortado sobre o elemento alvo.
 * - Em passos advanceOn:"action", o furo fica CLICÁVEL e o passo só avança
 *   quando a tela real emite o evento esperado (emitMissionEvent).
 * - Em passos advanceOn:"next", avança no botão do balão.
 */
export default function MissionTour({ index, onAdvance, onSkip, renderSpecial }: MissionTourProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [entering, setEntering] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const measureTimer = useRef<number | null>(null);
  const navStepRef = useRef<string | null>(null);

  const step = missionSteps[index];

  // ---- Navegação até a rota do passo (UMA vez ao entrar no passo) ----------
  // Não puxa o usuário de volta se ele navegar sozinho — ex.: entrar no DEFCON
  // na fase da primeira venda. Só leva à rota quando o passo muda.
  useEffect(() => {
    if (!step) return;
    if (navStepRef.current === step.id) return;
    navStepRef.current = step.id;
    if (location.pathname !== step.route) {
      navigate(step.route, { replace: true });
    }
  }, [step, location.pathname, navigate]);

  // ---- Medição do alvo (com scroll-into-view) -----------------------------
  const measure = useCallback(() => {
    if (!step?.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!step || step.special) return;
    // espera a rota montar / pintar antes de medir
    measureTimer.current = window.setTimeout(measure, 420);
    // remede após o scroll suave assentar
    const settle = window.setTimeout(measure, 900);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      if (measureTimer.current) window.clearTimeout(measureTimer.current);
      window.clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, step, location.pathname, index]);

  // animação de entrada do balão a cada passo
  useEffect(() => {
    setEntering(false);
    const t = window.setTimeout(() => setEntering(true), 140);
    return () => window.clearTimeout(t);
  }, [index]);

  // Quando um modal (Radix Dialog) abre — ex: EditPlanningModal na fase de metas —
  // suprime o escurecimento da missão pra não cobrir o modal. O passo ainda
  // avança pelo evento de ação (ex: goal-set ao salvar).
  useEffect(() => {
    const check = () =>
      setDialogOpen(!!document.querySelector('[role="dialog"][data-state="open"]'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    return () => obs.disconnect();
  }, [index]);

  // ---- Trava por ação real -------------------------------------------------
  useEffect(() => {
    if (!step || step.advanceOn !== "action" || !step.actionEvent) return;
    const off = onMissionEvent((type) => {
      if (type === step.actionEvent) onAdvance();
    });
    return off;
  }, [step, onAdvance]);

  // Escape pula a missão
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  if (!step) return null;

  // ---- Passos especiais (assinatura / recompensa) -------------------------
  if (step.special) {
    return <>{renderSpecial?.(step.special, { onAdvance, onSkip })}</>;
  }

  const progress = (step.phase / TOTAL_PHASES) * 100;
  const isAction = step.advanceOn === "action";

  // Geometria do furo
  const hole = rect
    ? {
        top: Math.max(rect.top - PAD, 0),
        left: Math.max(rect.left - PAD, 0),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // Tooltip acima ou abaixo do alvo
  const tooltipBelow = rect ? rect.bottom + 200 < window.innerHeight : true;

  return (
    <div
      className="fixed inset-0 z-[9998] pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label={`Missão de boas-vindas — ${step.title}`}
    >
      {/* Barra de progresso da missão (abaixo da status bar / notch) */}
      <div
        className="fixed left-0 right-0 z-[10001] h-1.5 bg-muted"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Botão pular — destaque claro no rodapé, longe da status bar */}
      <button
        onClick={onSkip}
        className="group fixed left-1/2 -translate-x-1/2 z-[10002] pointer-events-auto flex items-center gap-2 text-sm font-extrabold tracking-wide text-foreground active:scale-95 transition-all px-7 py-3.5 rounded-full border border-primary/50 bg-card/95 backdrop-blur-xl shadow-[0_16px_44px_-12px_hsl(var(--primary)/0.55)] hover:border-primary"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          backgroundImage:
            "linear-gradient(180deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.04))",
        }}
      >
        Pular tutorial
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary group-hover:translate-x-0.5 transition-transform"
        >
          <polyline points="13 17 18 12 13 7" />
          <polyline points="6 17 11 12 6 7" />
        </svg>
      </button>

      {/* Painéis escuros ao redor do furo — deixam o furo CLICÁVEL (interactive) */}
      {!dialogOpen && (hole ? (
        <>
          <Panel style={{ top: 0, left: 0, right: 0, height: hole.top }} block={!isAction} />
          <Panel
            style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }}
            block={!isAction}
          />
          <Panel
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              right: 0,
              height: hole.height,
            }}
            block={!isAction}
          />
          <Panel
            style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }}
            block={!isAction}
          />
          {/* Ring pulsante no alvo */}
          <div
            className={cn(
              "absolute rounded-xl border-2 border-primary pointer-events-none transition-all duration-300",
              isAction && "animate-pulse",
            )}
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              boxShadow: "0 0 0 4px hsl(var(--primary) / 0.18), 0 0 24px hsl(var(--primary) / 0.35)",
            }}
          />
        </>
      ) : !isAction ? (
        // Passo informativo sem alvo: tocar EM QUALQUER LUGAR avança.
        <div className="absolute inset-0 bg-black/75 pointer-events-auto cursor-pointer" onClick={onAdvance} />
      ) : null)}

      {/* Balão do coachmark — escondido enquanto um modal está aberto */}
      {!dialogOpen && (
      <div
        className={cn(
          "fixed left-4 right-4 z-[10000] pointer-events-auto max-w-sm mx-auto transition-all duration-500 ease-out",
          entering ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
        )}
        style={
          rect
            ? {
                top: tooltipBelow ? Math.min(rect.bottom + 20, window.innerHeight - 220) : undefined,
                bottom: !tooltipBelow ? window.innerHeight - rect.top + 20 : undefined,
              }
            : { top: 64 }
        }
      >
        <div className="bg-card border border-primary/30 rounded-2xl p-5 shadow-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary/80 mb-1">
            Fase {step.phase} de {TOTAL_PHASES}
          </p>
          <h3 className="text-base font-bold text-foreground mb-1.5">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{step.instruction}</p>

          {isAction ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-primary animate-pulse">
                {step.cta ?? "👉 faça a ação"}
              </span>
              {step.optional && (
                <button
                  onClick={onAdvance}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  Pular passo
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {step.cta && <p className="text-sm font-semibold text-primary">{step.cta}</p>}
              <button
                onClick={onAdvance}
                className="w-full py-2.5 rounded-xl font-semibold text-sm text-primary-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform"
              >
                {step.optional ? "Continuar →" : "Entendi →"}
              </button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function Panel({ style, block }: { style: React.CSSProperties; block: boolean }) {
  return (
    <div
      className={cn("absolute transition-all duration-300", block ? "bg-black/75" : "bg-black/55")}
      // pointerEvents SEMPRE "auto": as áreas ao redor do alvo bloqueiam o toque,
      // então o usuário não consegue trocar de aba/abrir outra tela no meio do
      // tutorial. Só o "furo" (o alvo destacado) continua clicável.
      style={{ ...style, pointerEvents: "auto" }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
