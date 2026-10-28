/* Small shared pieces of the Raio-X: section title, tappable row, money. */
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { COR, haptic } from "@/components/financas/planejar/ui";
import { reais } from "@/components/financas/analise/tipos";

export { reais };
export const inteiro = (v: number) => reais(Math.round(v));

export function Titulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <h2 className="text-[15px] font-black uppercase tracking-[.08em]" style={{ color: COR.texto }}>{children}</h2>
      {acao}
    </div>
  );
}

export function LinkOuro({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={() => { haptic(); onClick(); }}
      className="group min-h-11 px-2 -mr-2 rounded-[12px] inline-flex items-center gap-0.5 text-[14px] font-extrabold transition-colors duration-100 active:bg-white/[.05]"
      style={{ color: COR.ouro }}>
      {children} <ChevronRight className="w-4 h-4 transition-transform duration-100 group-active:translate-x-0.5" strokeWidth={2.6} />
    </button>
  );
}

/** Row: background lifts, scale .99, chevron nudges 2px. */
export function Linha({ children, onClick, rotulo, borda = true }: { children: ReactNode; onClick: () => void; rotulo?: string; borda?: boolean }) {
  return (
    <button type="button" onClick={() => { haptic(); onClick(); }} aria-label={rotulo}
      className={`group w-full text-left flex items-center gap-3 py-3 -mx-2 px-2 rounded-[12px] transition-[transform,background-color] duration-[120ms] active:scale-[0.99] active:bg-white/[.05] ${borda ? "border-t first:border-t-0" : ""}`}
      style={{ borderColor: "rgba(255,255,255,.06)" }}>
      <span className="flex-1 min-w-0">{children}</span>
      <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-[120ms] group-active:translate-x-0.5" strokeWidth={2.4} style={{ color: "#5c5850" }} />
    </button>
  );
}
