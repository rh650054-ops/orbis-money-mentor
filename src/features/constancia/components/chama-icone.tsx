/* The flame as a vector (never an emoji: it can be lit, frozen, put out and animated).
   Same shape as the Dashboard v9.1 flame; three looks: acesa (gold), gelo (blue, frozen or lost),
   apagada (grey, never lit / lost for good). */
import { useState } from "react";

export type LookChama = "acesa" | "gelo" | "apagada";
const PATH = "M50 3 C56 23 62 35 66 48 L74 32 C86 50 92 62 92 80 C92 105 74 123 50 123 C26 123 8 105 8 80 C8 63 14 54 20 44 L25 57 C31 40 42 22 50 3 Z";
let seq = 0;

export function ChamaIcone({ size = 21, look = "acesa", brilho = true, className }: { size?: number; look?: LookChama; brilho?: boolean; className?: string }) {
  const [id] = useState(() => `vant-chama-${++seq}`);
  const stops = look === "gelo"
    ? [["0", "#F4FBFF"], ["0.5", "#BFE6FA"], ["1", "#6FB8E6"]]
    : [["0", "#FFF8EE"], ["0.30", "#FDE6C2"], ["0.62", "#F7C88C"], ["1", "#EDA45C"]];
  const sombra = !brilho ? undefined
    : look === "gelo" ? "drop-shadow(0 0 8px rgba(130,200,240,.55))"
    : look === "acesa" ? "drop-shadow(0 0 8px rgba(255,168,60,.55)) drop-shadow(0 0 18px rgba(255,140,20,.25))" : undefined;
  return (
    <svg width={size} height={Math.round(size * 1.28)} viewBox="0 0 100 128" aria-hidden className={className} style={sombra ? { filter: sombra } : undefined}>
      <defs>
        <linearGradient id={id} x1="0.14" y1="0.06" x2="0.86" y2="0.96">
          {stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
        </linearGradient>
      </defs>
      <path fill={look === "apagada" ? "#3A3730" : `url(#${id})`} stroke={look === "apagada" ? "#4A463D" : look === "gelo" ? "#E6F6FF" : "#FFF3DF"}
        strokeWidth="2.4" strokeLinejoin="round" d={PATH} />
      {look === "gelo" && <path d="M30 70 L45 85 M60 60 L72 74 M38 100 L58 92" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity=".7" />}
    </svg>
  );
}

/** Which look a state gets. Frozen or lost = ice; never lit = grey; rescue = lit (number locked). */
export function lookDoEstado(estado: string, dias: number): LookChama {
  if (estado === "congelada" || estado === "perdeu") return "gelo";
  if (estado === "nunca" || (estado === "acesa" && dias <= 0)) return "apagada";
  return "acesa";
}
