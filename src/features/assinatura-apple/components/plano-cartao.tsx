import { ChevronRight } from "lucide-react";
import type { PlanoDaTela } from "../lib/planos";

const GOLD = "#F5B800";

/** One compact plan card of the first screen (Paywall V3). Tapping it opens the plan's details,
    where the purchase happens. The price is StoreKit's, with its period; the annual plan is the
    highlighted one ("melhor custo-benefício") and shows its saving. */
export function PlanoCartao({ plano, atual, desabilitado, onAbrir }: {
  plano: PlanoDaTela; atual?: boolean; desabilitado?: boolean; onAbrir: () => void;
}) {
  const destaque = plano.anual;
  return (
    <button type="button" disabled={desabilitado} onClick={onAbrir}
      aria-label={`${plano.titulo}, ${plano.preco}${plano.periodo}${plano.economia ? `, economize ${plano.economia}%` : ""}${atual ? ", seu plano" : ""}`}
      className="relative w-full rounded-[18px] px-4 py-3 text-left flex items-center gap-3 active:scale-[.99] transition-transform disabled:opacity-60"
      style={destaque
        ? { border: `1.5px solid ${GOLD}`, background: "linear-gradient(165deg,#221804 0%,#0d0c09 75%)", boxShadow: "0 10px 34px -18px rgba(245,184,0,.55)" }
        : { border: "1px solid #24221d", background: "#0c0c0e" }}>
      {destaque && !atual && (
        <span className="absolute -top-[9px] left-4 rounded-full px-2 py-[2px] text-[9px] font-black tracking-[.12em]" style={{ background: GOLD, color: "#1A1200" }}>
          MELHOR CUSTO-BENEFÍCIO
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[14.5px] font-black" style={{ color: destaque ? GOLD : "#F4F1EA" }}>{plano.titulo}</span>
          {atual && <span className="rounded-full px-2 py-[2px] text-[9.5px] font-black" style={{ background: "rgba(255,255,255,.08)", color: "#b9b3a6" }}>SEU PLANO</span>}
        </span>
        <span className="flex items-baseline gap-1 mt-0.5 leading-none">
          <span className="text-[21px] font-black tracking-[-.02em] tabular-nums" style={{ color: destaque ? "#FFF6DA" : "#F4F1EA" }}>{plano.preco}</span>
          <span className="text-[12.5px] font-bold" style={{ color: "#a9a397" }}>{plano.periodo}</span>
        </span>
      </span>
      {plano.economia ? (
        <span className="shrink-0 rounded-full px-2 py-[3px] text-[10.5px] font-black" style={{ background: "rgba(73,217,138,.14)", color: "#49d98a" }}>
          Economize {plano.economia}%
        </span>
      ) : null}
      <ChevronRight aria-hidden className="w-4 h-4 shrink-0" style={{ color: "#6f6a60" }} />
    </button>
  );
}
