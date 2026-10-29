/* Peças puras do card principal do Foco: trio de números, anel de progresso e a faixa da missão. */
import type { ReactNode } from "react";
import { Crosshair, ChevronRight } from "lucide-react";
import type { MissaoHoje } from "@/shared/lib/meta-viavel";

export function Trio({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <div className="flex mt-4 pt-3.5 border-t" style={{ borderColor: "rgba(255,255,255,.09)" }}>
      {itens.map(([k, v], i) => (
        <div key={k} className={`flex-1 min-w-0 text-center ${i ? "border-l" : ""}`} style={i ? { borderColor: "rgba(255,255,255,.09)" } : undefined}>
          <p className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: "var(--orbis-fg-3)" }}>{k}</p>
          <p className="orbis-num text-[14.5px] font-extrabold mt-1 whitespace-nowrap truncate px-1">{v}</p>
        </div>
      ))}
    </div>
  );
}

export function AnelProgresso({ pct, valor, cor }: { pct: number; valor: string; cor: string }) {
  const size = 116, stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cor} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.2,0,0,1)" }} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="orbis-num text-[22px] font-extrabold leading-none tracking-[-.02em]" style={{ color: cor }}>{valor}</span>
        <span className="text-[11px] font-bold mt-1" style={{ color: "var(--orbis-fg-3)" }}>{Math.round(p)}% da meta</span>
      </span>
    </span>
  );
}

/** 28/10: com missão de lucro ativa, a meta do dia é a da missão — esta faixa diz de onde vem o número. */
export function FaixaMissao({ m, onAbrir }: { m: MissaoHoje; onAbrir?: () => void }) {
  const p = (m.produto ?? "").toLowerCase();
  const un = !p ? "unidades" : p.endsWith("s") ? p : `${p}s`;
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const ritmo = m.ritmo === "adiantado" ? { txt: `adiantado ${brl(Math.abs(m.atraso ?? 0))}`, cor: "var(--orbis-ok)" }
    : m.ritmo === "atrasado" ? { txt: `${brl(Math.abs(m.atraso ?? 0))} atrás do plano`, cor: "#F2465A" } : null;
  return (
    <div role={onAbrir ? "button" : undefined} tabIndex={onAbrir ? 0 : undefined} onClick={onAbrir} aria-label={onAbrir ? "Abrir a missão: editar ou apagar" : undefined}
      className={`mt-3 rounded-[14px] px-3 py-2.5 flex items-center gap-2.5 ${onAbrir ? "cursor-pointer active:scale-[0.99] transition-transform" : ""}`} style={{ background: m.trabalha ? "rgba(245,184,0,.08)" : "rgba(255,255,255,.04)", border: `1px solid ${m.trabalha ? "rgba(245,184,0,.35)" : "rgba(255,255,255,.12)"}` }}>
      <Crosshair className="w-4 h-4 shrink-0" style={{ color: m.trabalha ? "var(--orbis-gold)" : "var(--orbis-fg-3)" }} />
      <p className="text-[12px] leading-snug min-w-0" style={{ color: "var(--orbis-fg-2)" }}>
        <b style={{ color: "var(--orbis-gold)" }}>Missão {brl(m.alvo)}</b>{m.diasPeriodo > 0 ? <> · dia {m.dia}/{m.diasPeriodo}</> : null}
        {m.trabalha
          ? <> · hoje <b className="text-foreground">{m.unidMeta} {un}</b> = <b style={{ color: "var(--orbis-ok)" }}>+{brl(m.precisaLucro)}</b> de lucro</>
          : <> · <b className="text-foreground">folga no plano</b> — se for pra rua, {m.unidMeta} {un} adiantam</>}
        {ritmo ? <> · <b style={{ color: ritmo.cor }}>{ritmo.txt}</b></> : null}
      </p>
      {onAbrir && <ChevronRight className="w-4 h-4 shrink-0 ml-auto" style={{ color: "var(--orbis-fg-3)" }} />}
    </div>
  );
}
