/* VANT UI primitives (black, gold, dark cards): section card, bottom sheet, toggle,
   press button and list rows. Born in Minha Conta; shared so every screen matches. */
import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/shared/ui/sheet";

export const COR = {
  ouro: "#F5B800", texto: "#F4F1EA", apagado: "#8a8378", suave: "#b9b3a6",
  card: "#0e0e10", borda: "#22201a", coral: "#FF6B5B", ok: "#3DD68C", info: "#7DB7FF",
} as const;

/** Light haptic tick where the phone supports it. */
export function tique() {
  try { navigator.vibrate?.(8); } catch { /* not supported */ }
}

export function Secao({ titulo, acao, children, id }: { titulo: string; acao?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <h2 id={id} className="text-[10.5px] font-black tracking-[.16em]" style={{ color: COR.apagado }}>{titulo}</h2>
        <span className="flex-1" />
        {acao}
      </div>
      <div className="rounded-[18px] p-4" style={{ background: COR.card, border: `1px solid ${COR.borda}` }}>{children}</div>
    </section>
  );
}

type BotaoProps = {
  children: ReactNode; onClick?: () => void; tipo?: "ouro" | "linha" | "texto" | "perigo";
  disabled?: boolean; className?: string; rotulo?: string;
};
/** Press: scale .97 in ~110 ms. */
export function Botao({ children, onClick, tipo = "linha", disabled, className = "", rotulo }: BotaoProps) {
  const estilo = {
    ouro: { background: COR.ouro, color: "#1A1200" },
    linha: { border: `1px solid ${COR.borda}`, color: COR.texto, background: "#141416" },
    texto: { color: COR.ouro },
    perigo: { color: COR.coral },
  }[tipo];
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={rotulo}
      className={`rounded-xl px-3.5 h-10 text-[13px] font-extrabold transition-transform duration-100 active:scale-[0.97] disabled:opacity-50 ${className}`}
      style={estilo}>
      {children}
    </button>
  );
}

/** Toggle with a 200 ms slide and a haptic tick. */
export function Interruptor({ ligado, onChange, rotulo, disabled }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={disabled}
      onClick={() => { tique(); onChange(!ligado); }}
      className="relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 disabled:opacity-50"
      style={{ background: ligado ? COR.ouro : "#2a2823" }}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200"
        style={{ background: ligado ? "#1A1200" : "#8a8378", transform: ligado ? "translateX(20px)" : "translateX(0)" }} />
    </button>
  );
}

export function LinhaToggle({ titulo, sub, ligado, onChange, disabled }: { titulo: string; sub?: string; ligado: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold">{titulo}</p>
        {sub && <p className="text-[12px]" style={{ color: COR.apagado }}>{sub}</p>}
      </div>
      <Interruptor ligado={ligado} onChange={onChange} rotulo={titulo} disabled={disabled} />
    </div>
  );
}

/** Label/value row ("Nome — Rick"). */
export function LinhaDado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex items-baseline gap-3 py-2 border-b last:border-b-0" style={{ borderColor: "#1b1a17" }}>
      <span className="w-24 shrink-0 text-[12px] font-bold" style={{ color: COR.apagado }}>{rotulo}</span>
      <span className="flex-1 min-w-0 truncate text-[14px] font-semibold" style={{ color: valor ? COR.texto : COR.apagado }}>{valor || "não informado"}</span>
    </div>
  );
}

/** Bottom sheet in the VANT look. */
export function Folha({ aberta, onFechar, titulo, sub, children }: { aberta: boolean; onFechar: () => void; titulo: string; sub?: string; children: ReactNode }) {
  return (
    <Sheet open={aberta} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[22px] border-0 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+20px)] max-w-lg mx-auto"
        style={{ background: "#0b0b0c", color: COR.texto, borderTop: `1px solid ${COR.borda}` }}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: "#2a2823" }} />
        <SheetTitle className="text-lg font-black" style={{ color: COR.texto }}>{titulo}</SheetTitle>
        <SheetDescription className={sub ? "text-[13px] -mt-1" : "sr-only"} style={{ color: COR.apagado }}>{sub || titulo}</SheetDescription>
        <div className="mt-3 flex flex-col gap-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-black tracking-[.12em]" style={{ color: COR.apagado }}>{rotulo}</span>
      {children}
      {dica && <span className="text-[11.5px]" style={{ color: COR.apagado }}>{dica}</span>}
    </label>
  );
}

export const INPUT = "w-full h-11 rounded-xl px-3 text-[15px] font-semibold outline-none focus:ring-2 focus:ring-[#F5B800]/50 bg-[#141416] border border-[#22201a] text-[#F4F1EA] placeholder:text-[#5d5850]";
