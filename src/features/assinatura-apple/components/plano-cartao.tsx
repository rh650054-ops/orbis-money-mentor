import { Check } from "lucide-react";
import type { PlanoDaTela } from "../lib/planos";

const GOLD = "#F5B800";

/** One plan. The amount CHARGED and its period are always the largest price on the card; the
    monthly equivalent of the annual plan is information below it. The annual plan is the
    highlighted one ("melhor custo-benefício"). */
export function PlanoCartao({ plano, selecionado, atual, desabilitado, onSelecionar }: {
  plano: PlanoDaTela; selecionado: boolean; atual?: boolean; desabilitado?: boolean; onSelecionar: () => void;
}) {
  const destaque = plano.anual;
  return (
    <button type="button" role="radio" aria-checked={selecionado} disabled={desabilitado || atual} onClick={onSelecionar}
      className="relative w-full rounded-[20px] px-4 pt-3.5 pb-3.5 text-left transition-[border-color,background] duration-200 disabled:opacity-70"
      style={selecionado
        ? { border: `1.5px solid ${GOLD}`, background: destaque ? "linear-gradient(165deg,#221804 0%,#0d0c09 70%)" : "#12100a", boxShadow: destaque ? "0 10px 40px -18px rgba(245,184,0,.55)" : undefined }
        : { border: "1px solid #24221d", background: "#0c0c0e" }}>
      {destaque && !atual && (
        <span className="absolute -top-[10px] left-4 rounded-full px-2.5 py-[3px] text-[9.5px] font-black tracking-[.12em]"
          style={{ background: GOLD, color: "#1A1200" }}>MELHOR CUSTO-BENEFÍCIO</span>
      )}
      <span className="flex items-center justify-between gap-2">
        <span className="text-[14.5px] font-black" style={{ color: destaque ? GOLD : "#F4F1EA" }}>{plano.titulo}</span>
        {atual ? (
          <span className="rounded-full px-2 py-[3px] text-[10px] font-black" style={{ background: "rgba(255,255,255,.08)", color: "#b9b3a6" }}>SEU PLANO</span>
        ) : (
          <span aria-hidden className="w-[20px] h-[20px] rounded-full flex items-center justify-center shrink-0 transition-colors"
            style={selecionado ? { background: GOLD, color: "#1A1200" } : { border: "1.5px solid #47433a" }}>
            {selecionado && <Check className="w-3 h-3" strokeWidth={3.5} />}
          </span>
        )}
      </span>
      <span className="flex items-baseline gap-1.5 mt-1.5 leading-none">
        <span className="text-[26px] font-black tracking-[-.02em] tabular-nums" style={{ color: destaque ? "#FFF6DA" : "#F4F1EA" }}>{plano.preco}</span>
        <span className="text-[13px] font-bold" style={{ color: "#a9a397" }}>{plano.periodo}</span>
        {plano.economia ? (
          <span className="ml-auto self-center rounded-full px-2 py-[3px] text-[10.5px] font-black" style={{ background: "rgba(73,217,138,.14)", color: "#49d98a" }}>
            Economize {plano.economia}%
          </span>
        ) : null}
      </span>
      {plano.anual
        ? plano.equivalente && <span className="block text-[12px] mt-1.5" style={{ color: "#8f897c" }}>Cobrado uma vez por ano. Equivale a {plano.equivalente} por mês.</span>
        : <span className="block text-[12px] mt-1.5" style={{ color: "#8f897c" }}>{plano.linha}</span>}
    </button>
  );
}
