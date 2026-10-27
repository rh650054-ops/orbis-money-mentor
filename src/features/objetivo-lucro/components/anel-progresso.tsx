/* Progress ring with the value inside. */
import type { ReactNode } from "react";

export function AnelProgresso({ pct, cor, tamanho = 112, children }: { pct: number; cor: string; tamanho?: number; children: ReactNode }) {
  const r = (tamanho - 10) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} className="-rotate-90">
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={8} />
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke={cor} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * p) / 100} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)", filter: `drop-shadow(0 0 6px ${cor}88)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
