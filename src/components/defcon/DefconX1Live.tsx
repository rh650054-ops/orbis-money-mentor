import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Swords } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import type { X1LiveState } from "@/hooks/useX1DefconAlert";
import { X1Faces } from "@/components/x1/X1Avatar";

// Widget do X1 DENTRO do DEFCON — 2 peças (fotos reais, sem emoji):
//
// 1) FAIXA DE PLACAR (sempre visível quando há duelo hoje):
//    [foto VC][foto ELE] "+R$ 42 na frente do Yan" · POTE 40
//    Na frente = verde/dourado; atrás = vermelho pulsando; empate = neutro.
//    Toca → abre a arena.
//
// 2) TOAST DE VIRADA (só quando o oponente passa ou você retoma): overlay no
//    topo, vibra, some sozinho em 6s. Cooldown de 90s vem do hook.
const primeiro = (n: string) => (n || "ele").trim().split(/\s+/)[0] || "ele";

export function DefconX1Live({ x1 }: { x1: X1LiveState }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!x1.event) return;
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(x1.event.type === "overtaken" ? [90, 50, 90] : [60]);
    } catch { /* sem vibração */ }
    const t = setTimeout(() => x1.dismissEvent(), 6000);
    return () => clearTimeout(t);
  }, [x1.event, x1]);

  if (!x1.hasDuel) return null;

  const behind = x1.lead === "opp";
  const ahead = x1.lead === "me";
  const diff = Math.abs(x1.opp - x1.my);
  const nome = primeiro(x1.oppName);
  const cor = behind ? "#ff7d8c" : ahead ? "#3DD68C" : "#b3ab9c";

  return (
    <>
      <button
        onClick={() => navigate("/x1")}
        aria-label="Abrir arena do X1"
        className={`mx-auto flex items-center gap-2 pl-1.5 pr-2.5 h-10 rounded-full border active:scale-95 transition-transform max-w-[92vw] ${behind ? "animate-pulse-slow" : ""}`}
        style={behind
          ? { background: "linear-gradient(160deg,#1c0808,#0c0c0f)", borderColor: "rgba(242,70,90,.55)", boxShadow: "0 0 14px rgba(242,70,90,.3)" }
          : ahead
            ? { background: "radial-gradient(ellipse at top,#171006,#0c0c0f)", borderColor: "rgba(245,184,0,.5)", boxShadow: "0 0 12px rgba(245,184,0,.25)" }
            : { background: "#101014", borderColor: "#26262e" }}
      >
        <span className="relative inline-flex">
          <X1Faces eu={{ url: x1.myAvatar, nome: x1.myName }} ele={{ url: x1.oppAvatar, nome: x1.oppName }} size={28} />
          <i className="absolute -right-0.5 -bottom-0.5 w-2 h-2 rounded-full animate-pulse" style={{ background: "#F2465A", border: "1.5px solid #000" }} />
        </span>
        <span className="text-left min-w-0">
          <span className="block text-[11.5px] font-black leading-tight truncate" style={{ color: cor }}>
            {ahead ? `+${formatCurrency(diff)} na frente de ${nome}` : behind ? `${nome} tá ${formatCurrency(diff)} na frente` : `Empate com ${nome}`}
          </span>
          <span className="block text-[9.5px] font-bold leading-tight tabular-nums" style={{ color: "#8a8378" }}>
            {formatCurrency(x1.my)} × {formatCurrency(x1.opp)}{x1.stakes > 0 ? ` · pote ${formatCurrency(x1.stakes * 2)}` : " · amistoso"}
          </span>
        </span>
      </button>

      {x1.event && (
        <button
          onClick={() => x1.dismissEvent()}
          className="fixed left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm rounded-2xl px-4 py-3 flex items-center gap-3 text-left animate-in slide-in-from-top-4 fade-in duration-300"
          style={{
            top: "calc(env(safe-area-inset-top) + 12px)",
            ...(x1.event.type === "overtaken"
              ? { background: "linear-gradient(160deg,#450a0a,#1c0808)", border: "1px solid rgba(242,70,90,.7)", boxShadow: "0 0 30px rgba(242,70,90,.5)" }
              : { background: "radial-gradient(ellipse at top,#1a1206,#0c0c0f)", border: "1px solid rgba(245,184,0,.7)", boxShadow: "0 0 30px rgba(245,184,0,.45)" }),
          }}
        >
          <span className="w-10 h-10 rounded-[12px] shrink-0 flex items-center justify-center" style={{ background: x1.event.type === "overtaken" ? "#2a0c11" : "#1a1305", border: `1px solid ${x1.event.type === "overtaken" ? "#F2465A66" : "#3a2f0c"}` }}>
            <Swords className="w-5 h-5" style={{ color: x1.event.type === "overtaken" ? "#ff7d8c" : "#F5B800" }} strokeWidth={2.6} />
          </span>
          <span className="min-w-0">
            {x1.event.type === "overtaken" ? (
              <>
                <b className="block text-[13.5px] font-black text-red-200 leading-tight">{nome} te passou · {formatCurrency(diff)} na frente</b>
                <small className="block text-[11.5px] text-red-200/80 mt-0.5">{diff > 0 ? `Uma venda de ${formatCurrency(Math.ceil(diff))} vira. VAI!` : "Tá colado — a próxima venda decide."}</small>
              </>
            ) : (
              <>
                <b className="block text-[13.5px] font-black text-amber-200 leading-tight">Você retomou a liderança</b>
                <small className="block text-[11.5px] text-amber-200/80 mt-0.5">{nome} ficou pra trás. Não deixa ele voltar.</small>
              </>
            )}
          </span>
        </button>
      )}
    </>
  );
}
