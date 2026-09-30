/* Peças compartilhadas do Caixa da Vant: moeda, logo, tiles, gráfico de saldo. */
import type { ReactNode } from "react";
import { moeda } from "./caixa-fmt";

export function VantLogo() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs><linearGradient id="cxg" gradientUnits="userSpaceOnUse" x1="36" y1="58" x2="96" y2="6"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#FFC800" /></linearGradient></defs>
      <path d="M100 2 L0 54.8 L66.7 29.8 L46.6 58.3 L24.6 92.6 L60.8 51.8 Z" fill="url(#cxg)" />
      <path d="M45.6 46.3 L11 60.3 L27.2 60.3 L11.7 94.2 L29.1 71.3 Z" fill="#fff" />
    </svg>
  );
}

export function Tile({ k, big, cor, sub, className }: { k: ReactNode; big: ReactNode; cor?: string; sub?: ReactNode; className?: string }) {
  return (
    <div className={`cx-card cx-tile ${className ?? ""}`}>
      <span className="k">{k}</span>
      <div className="big num" style={cor ? { color: cor } : undefined}>{big}</div>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function Src({ tipo, children }: { tipo: "live" | "man" | "est" | "warn"; children: ReactNode }) {
  return <span className={`cx-src ${tipo}`}>{children}</span>;
}

/** Linha do saldo dia a dia, com bolinha verde nos dias que entrou e vermelha nos que saiu. */
export function SaldoChart({ serie }: { serie: { d: string; saldo: number; entrou: number; saiu: number }[] }) {
  const W = 640, H = 220, L = 52, R = 14, T = 16, B = 28;
  if (serie.length === 0) return <p className="cx-empty">Sem movimento ainda neste mês.</p>;
  const vals = serie.map((p) => p.saldo);
  const mx = Math.max(...vals, 0) * 1.1 || 1;
  const mn = Math.min(0, ...vals) * 1.1;
  const x = (i: number) => L + (serie.length > 1 ? (i / (serie.length - 1)) * (W - L - R) : (W - L - R) / 2);
  const y = (v: number) => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
  const path = serie.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.saldo).toFixed(1)}`).join(" ");
  const fmt = (v: number) => Math.round(v).toLocaleString("pt-BR");
  const ticks = [mn, mn + (mx - mn) / 2, mx];
  const labels = serie.filter((_, i) => i % Math.max(1, Math.round(serie.length / 7)) === 0 || i === serie.length - 1);
  const ult = serie[serie.length - 1]!;
  return (
    <svg className="cx-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Saldo em conta dia a dia">
      {ticks.map((v, i) => (
        <g key={i}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.07)"} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{fmt(v)}</text></g>
      ))}
      <path d={`${path} L${x(serie.length - 1).toFixed(1)} ${y(mn).toFixed(1)} L${x(0).toFixed(1)} ${y(mn).toFixed(1)} Z`} fill="rgba(255,200,0,.12)" />
      <path d={path} fill="none" stroke="#FFC800" strokeWidth="2.5" strokeLinejoin="round" />
      {serie.map((p, i) => (p.entrou > 0 || p.saiu > 0) && (
        <circle key={p.d} cx={x(i)} cy={y(p.saldo)} r="4" fill={p.entrou >= p.saiu ? "#3DD68C" : "#FF5A45"} stroke="#111110" strokeWidth="1.5" />
      ))}
      {labels.map((p) => <text key={p.d} x={x(serie.indexOf(p))} y={H - 8} textAnchor="middle">{p.d.slice(8, 10)}</text>)}
      <text x={x(serie.length - 1) - 4} y={y(ult.saldo) - 10} textAnchor="end" style={{ fill: "#FFC800", fontWeight: 900, fontSize: 12 }}>{moeda(ult.saldo, true)}</text>
    </svg>
  );
}

/** Janela simples (sem Radix — evita o bug de pointer-events travado). Fecha no Esc e no fundo. */
export function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="cx-modal" role="dialog" aria-modal="true" aria-label={titulo}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="cx-card">
        <div className="cx-hd" style={{ marginBottom: 12 }}>
          <h2>{titulo}</h2>
          <button type="button" className="cx-btn sm" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
