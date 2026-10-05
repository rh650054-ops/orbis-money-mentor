/* ============================================================
   PLANEJAR — peças comuns (05/10/2026, redesenho da aba Planejar).
   Cores com significado fixo: amarelo = ação/hoje, verde = protegido/feito,
   coral = vencido/risco. Todo botão tem estado pressionado (scale) e os
   números/barras animam ao mudar.
   ============================================================ */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Gaveta } from "@/shared/components/gaveta";
import { cn } from "@/shared/lib/utils";

export const COR = {
  ouro: "#F5B800",
  verde: "#3DD68C",
  coral: "#FF6B5E",
  texto: "#F4F1EA",
  sub: "#b3ada3",
  mute: "#8f897f",
  surface: "#131211",
  surface2: "#1A1A1A",
  borda: "#2A2A2A",
  folha: "#121212",
} as const;

/** Vibração curta onde o aparelho deixar (Android/Chrome). iOS ignora. */
export function haptic(tipo: "toque" | "sucesso" = "toque") {
  try { navigator.vibrate?.(tipo === "sucesso" ? [12, 40, 18] : 8); } catch { /* sem vibração */ }
}

export function Rotulo({ children, cor = COR.sub, className }: { children: React.ReactNode; cor?: string; className?: string }) {
  return <p className={cn("text-[12px] font-bold uppercase tracking-[.12em]", className)} style={{ color: cor }}>{children}</p>;
}

export function Cartao({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={cn("orbis-card-in rounded-[20px] border p-5", className)} style={{ background: COR.surface, borderColor: "rgba(255,255,255,.07)", ...style }}>
      {children}
    </section>
  );
}

/** Barra de progresso: trilho escuro, preenchimento animado (~400ms). */
export function Barra({ pct, cor = COR.verde, altura = 8 }: { pct: number; cor?: string; altura?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setW(Math.max(0, Math.min(100, pct)))); return () => cancelAnimationFrame(t); }, [pct]);
  return (
    <div className="rounded-full overflow-hidden" style={{ height: altura, background: "#26241f" }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: cor, transition: "width 420ms cubic-bezier(.2,.8,.2,1)" }} />
    </div>
  );
}

/** Check que se desenha (~280ms). */
export function CheckAnimado({ cor = "currentColor", tamanho = 20 }: { cor?: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke={cor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: "planejarCheck 280ms ease-out forwards" }} />
      <style>{"@keyframes planejarCheck{to{stroke-dashoffset:0}}"}</style>
    </svg>
  );
}

type Estado = "normal" | "carregando" | "sucesso";

/** Botão principal: amarelo, 56px, scale .97 no toque. */
export function BotaoPrimario({ children, onClick, disabled, estado = "normal", sucessoTexto, className }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; estado?: Estado; sucessoTexto?: string; className?: string;
}) {
  return (
    <button type="button" onClick={() => { haptic(); onClick(); }} disabled={disabled || estado !== "normal"}
      className={cn("w-full h-14 rounded-[16px] flex items-center justify-center gap-2 text-[16px] font-bold transition-transform duration-100 ease-out active:scale-[0.97] disabled:active:scale-100", className)}
      style={estado === "sucesso"
        ? { background: COR.verde, color: "#08140d" }
        : { background: COR.ouro, color: "#141005", opacity: disabled ? 0.45 : 1 }}>
      {estado === "carregando" ? <Loader2 className="w-5 h-5 animate-spin" />
        : estado === "sucesso" ? <><CheckAnimado tamanho={22} />{sucessoTexto ?? "Valor registrado"}</>
        : children}
    </button>
  );
}

/** Botão secundário: superfície escura com borda, 44–48px, scale .98. */
export function BotaoSecundario({ children, onClick, className, tom, disabled }: {
  children: React.ReactNode; onClick: () => void; className?: string; tom?: "coral" | "ouro"; disabled?: boolean;
}) {
  const cor = tom === "coral" ? COR.coral : tom === "ouro" ? COR.ouro : COR.texto;
  return (
    <button type="button" onClick={() => { haptic(); onClick(); }} disabled={disabled}
      className={cn("min-h-11 px-3.5 rounded-[14px] border flex items-center justify-center gap-2 text-[14px] font-semibold transition-[transform,background-color] duration-100 active:scale-[0.98] active:bg-[#242424] disabled:opacity-45", className)}
      style={{ background: COR.surface2, borderColor: tom === "coral" ? "rgba(255,107,94,.35)" : COR.borda, color: cor }}>
      {children}
    </button>
  );
}

/** Chip de escolha: escuro com borda; selecionado = amarelo com texto preto; scale .96. */
export function Chip({ children, ativo, onClick }: { children: React.ReactNode; ativo: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={() => { haptic(); onClick(); }} aria-pressed={ativo}
      className="min-h-11 px-3 rounded-[12px] border text-[15px] font-bold whitespace-nowrap transition-transform duration-100 active:scale-[0.96]"
      style={ativo ? { background: COR.ouro, borderColor: COR.ouro, color: "#141005" } : { background: COR.surface2, borderColor: COR.borda, color: COR.texto }}>
      {children}
    </button>
  );
}

/** Linha tocável: destaque curto no toque + chevron opcional. */
export function LinhaTocavel({ children, onClick, className }: { children: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("w-full text-left rounded-[12px] -mx-2 px-2 transition-colors duration-150 active:bg-white/[.05]", className)}>
      {children}
    </button>
  );
}

/** Folha de baixo da aba Planejar (alça que arrasta, X visível), até ~85% da tela. */
export function Folha({ open, onOpenChange, titulo, subtitulo, children, alta }: {
  open: boolean; onOpenChange: (o: boolean) => void; titulo: string; subtitulo?: string; children: React.ReactNode; alta?: boolean;
}) {
  return (
    <Gaveta open={open} onOpenChange={onOpenChange} titulo={titulo}
      className={alta ? "max-h-[90vh]" : "max-h-[85vh]"} style={{ background: COR.folha, borderColor: "rgba(255,255,255,.08)" }}>
      <div className="px-5 pt-1 flex flex-col gap-4" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
        <div className="pr-10">
          <h2 className="text-[20px] font-bold leading-tight" style={{ color: COR.texto }}>{titulo}</h2>
          {subtitulo && <p className="text-[14px] mt-1" style={{ color: COR.sub }}>{subtitulo}</p>}
        </div>
        {children}
      </div>
    </Gaveta>
  );
}

/** Linha "rótulo ........ valor" das folhas de detalhe. */
export function LinhaValor({ rotulo, valor, cor, forte }: { rotulo: string; valor: string; cor?: string; forte?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-11 border-b last:border-b-0" style={{ borderColor: "rgba(255,255,255,.06)" }}>
      <span className="text-[15px]" style={{ color: COR.sub }}>{rotulo}</span>
      <span className={cn("text-[16px] tabular-nums", forte ? "font-extrabold" : "font-bold")} style={{ color: cor ?? COR.texto }}>{valor}</span>
    </div>
  );
}
