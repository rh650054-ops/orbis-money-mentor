/* Peças puras do card principal do Foco: trio de números, anel de progresso e a
   linha compacta do mês (sonho × realidade, com o atalho de replanejar). */
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { textoStatus, type MetaDoDia } from "@/shared/lib/meta-viavel";
import { brl0 } from "./foco-tipos";

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

const TOM: Record<MetaDoDia["status"], string> = {
  aprendendo: "#b9b3a6", folga: "#3DD68C", no_ritmo: "#3DD68C", apertado: "#F5B800", inviavel: "#F2465A",
};
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** O mês em uma linha: progresso do sonho e, se saiu do ritmo, o atalho de replanejar. */
export function MesCompacto({ m, oculto, onReplanejar }: { m: MetaDoDia; oculto: boolean; onReplanejar: () => void }) {
  const cor = TOM[m.status];
  const pede = m.status === "inviavel" || m.status === "apertado";
  const mes = MESES[Number(m.hoje.slice(5, 7)) - 1] ?? "";
  const pct = Math.min(100, (m.vendidoMes / Math.max(1, m.metaMensal)) * 100);
  const v = (n: number) => (oculto ? "R$ •••" : brl0(n));
  return (
    <button type="button" onClick={pede ? onReplanejar : undefined} className="w-full mt-3.5 pt-3 text-left border-t" style={{ borderColor: "rgba(255,255,255,.09)", cursor: pede ? "pointer" : "default" }}>
      <div className="flex items-center justify-between gap-x-2 gap-y-1.5 flex-wrap">
        <p className="text-[10px] font-bold uppercase tracking-[.1em] whitespace-nowrap" style={{ color: "var(--orbis-fg-3)" }}>
          {mes} · <span className="orbis-num normal-case tracking-normal text-[12px] text-foreground">{v(m.vendidoMes)}</span> de {v(m.metaMensal)}
        </p>
        <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-[3px] text-[9.5px] font-black whitespace-nowrap" style={{ color: cor, background: `${cor}1f` }}>
          {textoStatus(m)}{pede && <ChevronRight className="w-3 h-3" strokeWidth={3} />}
        </span>
      </div>
      <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
      </div>
    </button>
  );
}
