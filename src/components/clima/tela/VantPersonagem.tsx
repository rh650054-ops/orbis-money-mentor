/* ============================================================
   O VENDEDOR DA VANT — personagem original em SVG (08/10/2026).
   Substitui o boneco antigo (tinha "Orbis" estampado na roupa).
   Boné com a seta amarela da VANT, isopor e acessório do clima:
   guarda-chuva na chuva, cachecol no frio, óculos no sol/calor.
   É ambientação: pequeno, atrás do texto, aria-hidden.
   Animação leve em CSS (respira + acena); "reduzir movimento" desliga.
   ============================================================ */
import type { Estado } from "@/components/clima/ClimaTipos";

const PELE = "#8a5a3c";
const ROUPA = "#1d1d21";
const OURO = "#F5B800";

export function VantPersonagem({ estado, altura = 132, className }: { estado: Estado; altura?: number; className?: string }) {
  const chuva = estado === "chuva" || estado === "tempestade";
  const frio = estado === "frio";
  const sol = estado === "sol" || estado === "calor";
  return (
    <svg viewBox="0 0 130 150" height={altura} width={(altura * 130) / 150} aria-hidden className={className} style={{ overflow: "visible" }}>
      <style>{`
        @keyframes vp-respira { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2.5px) } }
        @keyframes vp-acena { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(-14deg) } }
        @keyframes vp-gota { 0% { transform: translateY(-6px); opacity: 0 } 30% { opacity: .9 } 100% { transform: translateY(26px); opacity: 0 } }
        .vp-corpo { animation: vp-respira 3.2s ease-in-out infinite; transform-box: fill-box; }
        .vp-braco { animation: vp-acena 1.6s ease-in-out infinite; transform-origin: 82px 62px; }
        .vp-gota { animation: vp-gota 1.1s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .vp-corpo, .vp-braco, .vp-gota { animation: none } }
      `}</style>
      {/* sombra no chão */}
      <ellipse cx="62" cy="142" rx="34" ry="5" fill="#000" opacity=".45" />
      <g className="vp-corpo">
        {/* pernas e tênis */}
        <rect x="47" y="102" width="11" height="34" rx="5" fill="#2a2930" />
        <rect x="63" y="102" width="11" height="34" rx="5" fill="#2a2930" />
        <ellipse cx="51" cy="137" rx="9.5" ry="4.5" fill="#F4F1EA" />
        <ellipse cx="70" cy="137" rx="9.5" ry="4.5" fill="#F4F1EA" />
        {/* moletom */}
        <rect x="40" y="56" width="42" height="52" rx="13" fill={ROUPA} />
        <path d="M49 58 Q61 70 73 58" stroke="#33323a" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* seta da VANT no peito */}
        <path d="M54 86 L70 78 L64 92 L62 84 Z" fill={OURO} />
        {/* alça + isopor */}
        <path d="M46 60 L33 84" stroke={OURO} strokeWidth="3" strokeLinecap="round" />
        <rect x="16" y="82" width="34" height="26" rx="5" fill="#F4F1EA" />
        <rect x="14" y="78" width="38" height="8" rx="3.5" fill={OURO} />
        <path d="M26 99 L38 93 L34 103 Z" fill="#1d1d21" opacity=".85" />
        {/* braço esquerdo (no isopor) */}
        <path d="M42 64 Q34 76 36 86" stroke={ROUPA} strokeWidth="9" strokeLinecap="round" fill="none" />
        <circle cx="36" cy="87" r="4.5" fill={PELE} />
        {/* cabeça */}
        <rect x="56" y="48" width="10" height="9" rx="3" fill={PELE} />
        <circle cx="61" cy="38" r="15" fill={PELE} />
        {sol
          ? <rect x="50" y="34.5" width="22" height="6" rx="3" fill="#0b0b0c" />
          : (<><circle cx="56" cy="38" r="1.9" fill="#141210" /><circle cx="66" cy="38" r="1.9" fill="#141210" /></>)}
        <path d="M55.5 44.5 Q61 49 66.5 44.5" stroke="#141210" strokeWidth="1.9" fill="none" strokeLinecap="round" />
        {/* boné com a seta */}
        <path d="M45.5 33 Q47 19 61 19 Q75 19 76.5 33 Z" fill={ROUPA} />
        <path d="M74 31 Q84 30 90 34 L76 35 Z" fill={ROUPA} />
        <path d="M56 29 L67 23.5 L63 32 L61.5 27.5 Z" fill={OURO} />
        {frio && <path d="M47 53 Q61 61 75 53 L75 59 Q61 66 47 59 Z M66 58 L70 72 L64 72 Z" fill={OURO} />}
        {/* braço direito: acena, ou segura o guarda-chuva */}
        {chuva ? (
          <g>
            <path d="M80 62 Q90 54 92 40" stroke={ROUPA} strokeWidth="9" strokeLinecap="round" fill="none" />
            <circle cx="92" cy="39" r="4.5" fill={PELE} />
            <line x1="92" y1="40" x2="92" y2="6" stroke="#cfcac0" strokeWidth="2.2" />
            <path d="M48 12 Q92 -26 128 12 Q117 7 107 12 Q97 6 88 12 Q78 6 68 12 Q58 7 48 12 Z" fill={OURO} />
            {[56, 74, 100, 118].map((x, i) => (
              <line key={x} className="vp-gota" x1={x} y1="16" x2={x - 1} y2="22" stroke="#6FA8FF" strokeWidth="1.8" strokeLinecap="round" style={{ animationDelay: `${i * 0.27}s` }} />
            ))}
          </g>
        ) : (
          <g className="vp-braco">
            <path d="M80 62 Q90 52 94 40" stroke={ROUPA} strokeWidth="9" strokeLinecap="round" fill="none" />
            <circle cx="94.5" cy="38.5" r="4.8" fill={PELE} />
          </g>
        )}
      </g>
    </svg>
  );
}
