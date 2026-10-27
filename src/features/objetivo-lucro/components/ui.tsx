/* Shared look of the profit challenge (same palette as Finanças/Planejar). */
import type { CSSProperties, ReactNode } from "react";

export const COR = {
  ouro: "#F5B800",
  verde: "#3DD68C",
  vermelho: "#e5737f",
  texto: "#e9e4d8",
  sub: "#b9b3a6",
  mute: "#7e7869",
  fundo: "#0e0e10",
  caixa: "#131211",
  linha: "rgba(255,255,255,.1)",
} as const;

export const PRESS = "active:scale-[0.97] transition-transform";

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  const style: CSSProperties = on
    ? { background: "rgba(245,184,0,.1)", border: `1.5px solid ${COR.ouro}`, color: COR.ouro }
    : { background: COR.caixa, border: "1px solid rgba(255,255,255,.12)", color: COR.sub };
  return (
    <button type="button" onClick={onClick} className={`h-10 px-3.5 rounded-full text-[13px] font-extrabold ${PRESS}`} style={style}>
      {children}
    </button>
  );
}

export function Linha({ k, v, cor }: { k: ReactNode; v: ReactNode; cor?: string }) {
  return (
    <div className="flex justify-between gap-3 text-[12.5px]">
      <span style={{ color: COR.sub }}>{k}</span>
      <span className="orbis-num font-extrabold text-right" style={{ color: cor ?? COR.texto }}>{v}</span>
    </div>
  );
}

export function Barra({ pct, cor }: { pct: number; cor: string }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1c1b20" }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: cor }} />
    </div>
  );
}
