import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import type { Delta } from "../lib/derivar";

/* Small building blocks shared by every block of the Relatório. The visual grammar
   (approved mockup v10, 18/10): grey uppercase kicker → card → one sentence with the
   answer → one drawing → at most two lines of fact. Gold means "the best one". */

export const COR = {
  gold: "var(--orbis-gold)",
  ok: "var(--orbis-ok)",
  calote: "var(--orbis-calote)",
  custo: "var(--orbis-custo)",
  fg2: "var(--orbis-fg-2)",
  fg3: "var(--orbis-fg-3)",
  cinza: "#3a3a3a",
  cinzaClaro: "#8a8a8a",
  pausa: "#8a7228",
} as const;

export function Secao({ kicker, right, children }: { kicker: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="orbis-section">{kicker}</p>
        {right ? <span className="text-xs text-muted-foreground">{right}</span> : null}
      </div>
      {children}
    </section>
  );
}

export function Cartao({ className, children, dourado = false }: { className?: string; children: ReactNode; dourado?: boolean }) {
  return (
    <div
      className={cn("rounded-2xl border p-3.5", dourado ? "border-[rgba(245,184,0,.34)]" : "border-border/60 bg-card", className)}
      style={dourado ? { background: "linear-gradient(180deg, #171203 0%, hsl(var(--card)) 60%)" } : undefined}
    >
      {children}
    </div>
  );
}

/** The sentence that answers the block's question. `<b>` inside is rendered gold. */
export function Frase({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mb-2.5 text-[14px] font-medium leading-snug [text-wrap:balance] [&_b]:font-bold [&_b]:text-primary", className)}>{children}</p>;
}

export function Fato({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-2.5 text-[12px] leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground", className)}>{children}</p>;
}

export function Chip({ delta, className, curto = false }: { delta: Delta | null; className?: string; curto?: boolean }) {
  if (!delta) return null;
  const texto = curto ? delta.texto.replace(/\s+vs\s.*$/, "") : delta.texto;
  const tom = delta.tom === "up" ? "text-[var(--orbis-ok)] bg-[rgba(61,214,140,.14)]"
    : delta.tom === "down" ? "text-[var(--orbis-calote)] bg-[rgba(255,92,92,.14)]"
    : "text-muted-foreground bg-secondary";
  return <span className={cn("orbis-num inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", tom, className)}>{texto}</span>;
}

/** One horizontal bar split into parts (percentages of 100). */
export function BarraDividida({ partes, altura = 14, className }: { partes: { pct: number; cor: string }[]; altura?: number; className?: string }) {
  return (
    <div className={cn("flex w-full overflow-hidden rounded-full bg-secondary", className)} style={{ height: altura }} aria-hidden>
      {partes.map((p, i) => (
        <i key={i} className="orbis-fill block h-full" style={{ width: `${Math.max(0, Math.min(100, p.pct))}%`, background: p.cor }} />
      ))}
    </div>
  );
}

/** A row of the "extrato" cards: icon dot · title (+ small line) · value on the right. */
export function Linha({ icone, iconeCor, titulo, sub, valor, valorCor, valorGrande = false, negrito = false }: {
  icone: string; iconeCor: string; titulo: ReactNode; sub?: ReactNode; valor: ReactNode; valorCor?: string; valorGrande?: boolean; negrito?: boolean;
}) {
  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 border-t border-white/[.07] py-2 first:border-t-0">
      <span className="grid h-[18px] w-[18px] place-items-center rounded-full text-[11px] font-extrabold" style={{ background: `${iconeCor}22`, color: iconeCor }}>{icone}</span>
      <span className={cn("min-w-0 text-[13.5px]", negrito && "font-bold")}>
        {titulo}
        {sub ? <small className="block truncate text-[11px] text-muted-foreground">{sub}</small> : null}
      </span>
      <span className={cn("orbis-num whitespace-nowrap text-right font-bold", valorGrande ? "text-[18px]" : "text-[14.5px]")} style={{ color: valorCor }}>{valor}</span>
    </div>
  );
}

/** Two big numbers side by side ("3h11 por dia · 82% vendendo"). */
export function DoisGrandes({ itens }: { itens: { valor: ReactNode; rotulo: ReactNode; cor?: string; fundo?: string; borda?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {itens.map((it, i) => (
        <div key={i} className="min-w-0 rounded-2xl bg-secondary px-3 py-2.5" style={{ background: it.fundo, border: it.borda ? `1px solid ${it.borda}` : undefined }}>
          <b className="orbis-num block text-[22px] font-bold leading-none tracking-tight" style={{ color: it.cor }}>{it.valor}</b>
          <span className="mt-1 block text-[11.5px] text-muted-foreground">{it.rotulo}</span>
        </div>
      ))}
    </div>
  );
}
