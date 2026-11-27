import { Check } from "lucide-react";
import type { PlanoDaTela } from "../lib/planos";

const GOLD = "#F5B800";

/** One plan. The amount CHARGED and its period are always the largest price on the card; the
    monthly equivalent of the annual plan is information below it. */
export function PlanoCartao({ plano, selecionado, atual, desabilitado, onSelecionar }: {
  plano: PlanoDaTela; selecionado: boolean; atual?: boolean; desabilitado?: boolean; onSelecionar: () => void;
}) {
  const destaque = plano.anual;
  return (
    <button type="button" role="radio" aria-checked={selecionado} disabled={desabilitado || atual} onClick={onSelecionar}
      className="relative w-full rounded-[18px] px-4 py-3.5 text-left transition-colors disabled:opacity-70"
      style={selecionado
        ? { border: `1.5px solid ${GOLD}`, background: destaque ? "linear-gradient(170deg,#1a1305,#0d0c09 75%)" : "#111009" }
        : { border: "1px solid #26241f", background: "#0e0e10" }}>
      <span className="flex items-center justify-between gap-2">
        <span className={`text-[14px] font-black ${destaque ? "tracking-[.06em]" : ""}`} style={{ color: destaque ? GOLD : "#F4F1EA" }}>
          {destaque ? plano.titulo.toUpperCase() : plano.titulo}
        </span>
        {atual ? (
          <span className="rounded-full px-2 py-[3px] text-[10px] font-black" style={{ background: "rgba(255,255,255,.08)", color: "#b9b3a6" }}>SEU PLANO</span>
        ) : (
          <span aria-hidden className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0"
            style={selecionado ? { background: GOLD, color: "#1A1200" } : { border: "1.5px solid #4a463d" }}>
            {selecionado && <Check className="w-3 h-3" strokeWidth={3.5} />}
          </span>
        )}
      </span>
      {plano.economia ? (
        <span className="inline-block mt-1.5 rounded-full px-2 py-[3px] text-[10.5px] font-black" style={{ background: "rgba(73,217,138,.14)", color: "#49d98a" }}>
          Economize {plano.economia}%
        </span>
      ) : null}
      <span className="block mt-1.5 leading-none">
        <span className="text-[26px] font-black tracking-[-.02em] tabular-nums" style={{ color: destaque ? GOLD : "#F4F1EA" }}>{plano.preco}</span>
        <span className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}> {plano.periodo}</span>
      </span>
      {plano.anual ? (
        <>
          {plano.equivalente && <span className="block text-[11.5px] mt-1" style={{ color: "#8f897c" }}>Cobrado uma vez por ano. Equivale a {plano.equivalente} por mês.</span>}
          <span className="block mt-3 pt-3 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
            {["Todos os benefícios do Pro", "12 meses de acesso"].map((b) => (
              <span key={b} className="flex items-center gap-2 text-[12px] font-bold"><Check className="w-3.5 h-3.5 shrink-0" style={{ color: GOLD }} strokeWidth={3} />{b}</span>
            ))}
          </span>
        </>
      ) : (
        <span className="block text-[12px] mt-1.5" style={{ color: "#b9b3a6" }}>{plano.linha}</span>
      )}
    </button>
  );
}
