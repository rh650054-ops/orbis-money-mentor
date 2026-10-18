/* VANT status pieces: colored pill, segmented control, press row.
   Color meaning is fixed app-wide: green = confirmed, gold = attention/action,
   coral = missing/error, blue = informative (e.g. landed later), gray = support. */
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { COR, tique } from "./vant-ui";

export type Tom = "ok" | "atencao" | "erro" | "info" | "neutro";
export const TOM: Record<Tom, string> = { ok: COR.ok, atencao: COR.ouro, erro: COR.coral, info: COR.info, neutro: COR.apagado };

export function Pilula({ tom, children }: { tom: Tom; children: ReactNode }) {
  const c = TOM[tom];
  return (
    <span className="shrink-0 inline-flex items-center rounded-full px-2 py-[3px] text-[10.5px] font-black tracking-[.04em] whitespace-nowrap"
      style={{ color: c, background: `${c}1a`, border: `1px solid ${c}55` }}>
      {children}
    </span>
  );
}

/** Two or three options; the active one slides in with a highlight (200 ms). */
export function Segmentado<T extends string>({ opcoes, valor, onEscolher, disabled, rotulo }: {
  opcoes: { valor: T; texto: string; cor?: string }[]; valor: T | null; onEscolher: (v: T) => void; disabled?: boolean; rotulo: string;
}) {
  const i = opcoes.findIndex((o) => o.valor === valor);
  const ativa = i >= 0 ? opcoes[i] : undefined;
  return (
    <div role="radiogroup" aria-label={rotulo} className="relative grid rounded-[11px] p-[3px]"
      style={{ gridTemplateColumns: `repeat(${opcoes.length}, 1fr)`, background: "#141416", border: `1px solid ${COR.borda}` }}>
      {ativa && (
        <span aria-hidden className="absolute top-[3px] bottom-[3px] rounded-[8px] transition-transform duration-200 ease-out"
          style={{ width: `calc((100% - 6px) / ${opcoes.length})`, left: 3, transform: `translateX(${i * 100}%)`,
            background: `${ativa.cor ?? COR.ouro}22`, border: `1px solid ${ativa.cor ?? COR.ouro}` }} />
      )}
      {opcoes.map((o) => (
        <button key={o.valor} type="button" role="radio" aria-checked={o.valor === valor} disabled={disabled}
          onClick={() => { if (o.valor !== valor) { tique(); onEscolher(o.valor); } }}
          className="relative h-8 text-[12px] font-black transition-colors duration-200 disabled:opacity-50"
          style={{ color: o.valor === valor ? (o.cor ?? COR.ouro) : COR.apagado }}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

/** Tappable row: background lifts on press, chevron nudges 2 px. */
export function LinhaToque({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="group w-full flex items-center gap-3 py-3 px-2 -mx-2 rounded-xl text-left transition-colors duration-100 active:bg-white/[.04] disabled:opacity-60">
      {children}
      <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-100 group-active:translate-x-[2px]" style={{ color: COR.apagado }} />
    </button>
  );
}
