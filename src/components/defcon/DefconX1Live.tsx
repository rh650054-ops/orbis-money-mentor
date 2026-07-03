import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/shared/lib/utils";
import type { X1LiveState } from "@/hooks/useX1DefconAlert";

// Widget do X1 DENTRO do DEFCON — 2 peças:
//
// 1) FAIXA DE PLACAR (sempre visível quando há duelo hoje): "⚔️ VS Fulano · R$X × R$Y".
//    Muda de cara conforme a liderança: na frente = dourado, atrás = vermelho
//    pulsando devagar, empate = neutro. Toca → abre a arena na aba X1.
//
// 2) BANNER DE VIRADA (só quando o oponente passa ou você retoma): overlay no topo,
//    vibra o aparelho, some sozinho em 6s. Cooldown de 90s vem do hook — não spamma.
export function DefconX1Live({ x1 }: { x1: X1LiveState }) {
  const navigate = useNavigate();

  // Banner some sozinho + vibração na virada (curta, tipo "soco": não irrita).
  useEffect(() => {
    if (!x1.event) return;
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(x1.event.type === "overtaken" ? [90, 50, 90] : [60]);
      }
    } catch {
      /* aparelho sem vibração — segue o jogo */
    }
    const t = setTimeout(() => x1.dismissEvent(), 6000);
    return () => clearTimeout(t);
  }, [x1.event, x1]);

  if (!x1.hasDuel) return null;

  const behind = x1.lead === "opp";
  const ahead = x1.lead === "me";
  const diff = Math.abs(x1.opp - x1.my);

  return (
    <>
      {/* ===== faixa de placar ao vivo ===== */}
      <button
        onClick={() => navigate("/x1")}
        aria-label="Abrir arena do X1"
        className={`mx-auto flex items-center gap-2 px-3 h-8 rounded-full border active:scale-95 transition-transform ${
          behind ? "animate-pulse-slow" : ""
        }`}
        style={
          behind
            ? { background: "linear-gradient(160deg,#1c0808,#0c0c0f)", borderColor: "rgba(239,68,68,.55)", boxShadow: "0 0 14px rgba(239,68,68,.3)" }
            : ahead
              ? { background: "radial-gradient(ellipse at top,#171006,#0c0c0f)", borderColor: "rgba(245,158,11,.5)", boxShadow: "0 0 12px rgba(245,158,11,.25)" }
              : { background: "#101014", borderColor: "#26262e" }
        }
      >
        <span className="text-[11px]">⚔️</span>
        <span className="text-[10px] font-black uppercase tracking-wider truncate max-w-[72px]" style={{ color: behind ? "#f87171" : "#f59e0b" }}>
          {x1.oppName}
        </span>
        <span className="text-[11px] font-black tabular-nums" style={{ color: ahead ? "#22c55e" : "#e5e7eb" }}>
          {formatCurrency(x1.my)}
        </span>
        <span className="text-[9px] font-black text-muted-foreground">×</span>
        <span className="text-[11px] font-black tabular-nums" style={{ color: behind ? "#f87171" : "#9ca3af" }}>
          {formatCurrency(x1.opp)}
        </span>
        <span className="text-[10px]">{ahead ? "🔥" : behind ? "⚠️" : "⚡"}</span>
      </button>

      {/* ===== banner de virada ===== */}
      {x1.event && (
        <button
          onClick={() => x1.dismissEvent()}
          className="fixed left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm rounded-2xl px-4 py-3 text-center animate-in slide-in-from-top-4 fade-in duration-300"
          style={{
            top: "calc(env(safe-area-inset-top) + 12px)",
            ...(x1.event.type === "overtaken"
              ? { background: "linear-gradient(160deg,#450a0a,#1c0808)", border: "1px solid rgba(239,68,68,.7)", boxShadow: "0 0 30px rgba(239,68,68,.5)" }
              : { background: "radial-gradient(ellipse at top,#1a1206,#0c0c0f)", border: "1px solid rgba(245,158,11,.7)", boxShadow: "0 0 30px rgba(245,158,11,.45)" }),
          }}
        >
          {x1.event.type === "overtaken" ? (
            <>
              <p className="text-sm font-black text-red-300" style={{ textShadow: "0 0 12px rgba(239,68,68,.8)" }}>
                ⚔️ {x1.oppName.toUpperCase()} PASSOU VOCÊ!
              </p>
              <p className="text-[11px] font-bold text-red-200/90 mt-0.5">
                {diff > 0 ? `${formatCurrency(diff)} pra virar — a próxima venda muda o jogo. VAI!` : "Tá colado — a próxima venda decide. VAI!"}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-black text-amber-300" style={{ textShadow: "0 0 12px rgba(245,158,11,.8)" }}>
                🔥 VOCÊ RETOMOU A LIDERANÇA!
              </p>
              <p className="text-[11px] font-bold text-amber-200/90 mt-0.5">
                {x1.oppName} ficou pra trás. Não deixa ele voltar — mantém o ritmo!
              </p>
            </>
          )}
        </button>
      )}
    </>
  );
}
