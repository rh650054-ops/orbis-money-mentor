/* Peças da ficha do produto: seção com título e o interruptor liga/desliga. */
import type { ReactNode } from "react";

export function Secao({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  return (
    <section className="rounded-[20px] p-4 flex flex-col gap-3" style={{ background: "#0e0e10", border: "1px solid #26241f" }}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[11px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>{titulo}</h2>
        {sub && <p className="text-[12px]" style={{ color: "#7b766e" }}>{sub}</p>}
      </div>
      {children}
    </section>
  );
}

export function Interruptor({ ligado, onMudar, titulo, sub }: { ligado: boolean; onMudar: (v: boolean) => void; titulo: string; sub?: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} onClick={() => onMudar(!ligado)}
      className="flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left" style={{ background: "#121211", border: "1px solid #26241f" }}>
      <span className="flex-1 flex flex-col">
        <span className="text-[14px] font-black">{titulo}</span>
        {sub && <span className="text-[11.5px] font-bold" style={{ color: "#7b766e" }}>{sub}</span>}
      </span>
      <span className="w-11 h-6 rounded-full relative shrink-0 transition" style={{ background: ligado ? "#F5B800" : "#2a2925" }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ left: ligado ? 22 : 2, background: ligado ? "#1A1200" : "#7b766e" }} />
      </span>
    </button>
  );
}
