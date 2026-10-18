/* Peças puras do card principal do Foco: trio de números e anel de progresso. */
import type { ReactNode } from "react";

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
