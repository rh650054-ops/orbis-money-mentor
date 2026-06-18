import { useEffect, useState } from "react";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { getCheckoutUrl } from "@/shared/lib/checkout";
import { Sparkles, X } from "lucide-react";

interface TrialNudgeProps {
  userId: string;
  /** Gancho ligado à funcionalidade (ex: "Tá curtindo o foco do DEFCON 4?") */
  title: string;
  /** A solução que aquela funcionalidade traz (o "porquê não perder") */
  benefit: string;
  /** Identifica o momento (ex: "defcon_day"). Mostra no máximo 1x por dia por momento. */
  momentKey: string;
}

/**
 * Empurrão persuasivo durante o teste grátis — NÃO é propaganda o tempo todo.
 * Só aparece se a pessoa está no teste (não pago/não demo/não expirado), e
 * só uma vez por dia por momento estratégico. Mostra o valor da funcionalidade
 * e quantos dias faltam, com a opção de assinar na hora.
 */
export function TrialNudge({ userId, title, benefit, momentKey }: TrialNudgeProps) {
  const { trialStatus, loading } = useTrialStatus(userId);
  const [closed, setClosed] = useState(false);
  const [show, setShow] = useState(false);

  const inTrial =
    trialStatus.isTrialActive &&
    trialStatus.planStatus !== "active" &&
    !trialStatus.isExpired;

  useEffect(() => {
    if (loading || !inTrial || !userId) {
      setShow(false);
      return;
    }
    const dayKey = `orbis_nudge_${momentKey}_${userId}_${new Date().toISOString().slice(0, 10)}`;
    let seen = false;
    try {
      seen = localStorage.getItem(dayKey) === "1";
    } catch {
      /* ignore */
    }
    if (!seen) {
      setShow(true);
      try {
        localStorage.setItem(dayKey, "1");
      } catch {
        /* ignore */
      }
    }
  }, [loading, inTrial, userId, momentKey]);

  if (!show || closed) return null;

  const days = Math.max(0, trialStatus.daysRemaining);

  return (
    <div
      className="relative w-full rounded-2xl p-4 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{
        background: "linear-gradient(180deg, hsl(var(--primary) / 0.16), rgba(255,255,255,0.02))",
        border: "1px solid hsl(var(--primary) / 0.4)",
        boxShadow: "0 16px 40px -16px rgba(0,0,0,0.7), 0 0 26px -12px hsl(var(--primary) / 0.4)",
      }}
    >
      <button
        onClick={() => setClosed(true)}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-1.5 pr-5">
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "hsl(var(--primary) / 0.18)", border: "1px solid hsl(var(--primary) / 0.4)" }}
        >
          <Sparkles className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
        </span>
        <h4 className="text-sm font-black text-foreground leading-tight">{title}</h4>
      </div>

      <p className="text-[13px] text-foreground/85 leading-snug">{benefit}</p>

      <p className="text-xs font-bold mt-2" style={{ color: "hsl(var(--primary))" }}>
        ⏳ Faltam {days} {days === 1 ? "dia" : "dias"} do seu teste grátis.
      </p>

      <button
        onClick={() => window.open(getCheckoutUrl(), "_blank")}
        className="w-full h-11 mt-3 rounded-xl font-extrabold text-sm text-primary-foreground active:scale-[0.98] transition-transform"
        style={{
          background: "linear-gradient(180deg, hsl(45 100% 58%), hsl(var(--primary)))",
          boxShadow: "0 10px 26px -8px hsl(var(--primary) / 0.6)",
        }}
      >
        Assinar agora e não perder nada
      </button>
      <button
        onClick={() => setClosed(true)}
        className="w-full h-9 mt-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        Continuar testando
      </button>
    </div>
  );
}
