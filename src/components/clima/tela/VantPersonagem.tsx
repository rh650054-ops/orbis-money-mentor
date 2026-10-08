/* ============================================================
   O VENDEDOR DA VANT — personagem proprietário em SVG (v2, 08/10/2026).
   Humano estilizado, urbano: moletom preto com cordão amarelo, calça cargo,
   tênis com sola amarela e o isopor de vendedor na alça. A VANT aparece só
   na setinha discreta do isopor. Muda com o clima:
   • sol/calor → boné + óculos + garrafinha;   • chuva → capuz + guarda-chuva;
   • frio → jaqueta puffer + gorro + cachecol;  • tempestade → abrigado na marquise;
   • boa janela → saindo pra vender (andando).
   Sombreado com gradiente (nada de clipart chapado). Animação ambiente leve;
   "reduzir movimento" desliga tudo.
   ============================================================ */
import { useId } from "react";
import type { Estado } from "@/components/clima/ClimaTipos";

import type { Pose } from "./visual";

export function VantPersonagem({ estado, pose = "parado", altura = 140, className }: { estado: Estado; pose?: Pose; altura?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const chuva = estado === "chuva";
  const frio = estado === "frio";
  const sol = estado === "sol" || estado === "calor";
  const abrigo = pose === "abrigo";
  const andando = pose === "andando";
  const capuz = chuva || abrigo || estado === "noite";
  const g = (n: string) => `url(#${n}-${id})`;
  return (
    <svg viewBox="0 0 130 172" height={altura} width={(altura * 130) / 172} aria-hidden className={className} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`roupa-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#34343b" /><stop offset=".55" stopColor="#1b1b20" /><stop offset="1" stopColor="#0f0f12" /></linearGradient>
        <linearGradient id={`calca-${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2a2a31" /><stop offset="1" stopColor="#17171b" /></linearGradient>
        <linearGradient id={`pele-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b47a52" /><stop offset="1" stopColor="#7d4c2e" /></linearGradient>
        <linearGradient id={`ouro-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFDC5C" /><stop offset="1" stopColor="#E3A400" /></linearGradient>
        <linearGradient id={`isopor-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fbf8f1" /><stop offset="1" stopColor="#d6d0c3" /></linearGradient>
        <radialGradient id={`aura-${id}`}><stop offset="0" stopColor="#F5B800" stopOpacity=".22" /><stop offset="1" stopColor="#F5B800" stopOpacity="0" /></radialGradient>
      </defs>
      <style>{`
        @keyframes vp-respira-${id} { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
        @keyframes vp-anda-${id} { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes vp-gota-${id} { 0% { transform: translateY(-8px); opacity: 0 } 25% { opacity: .85 } 100% { transform: translateY(34px); opacity: 0 } }
        .vp-corpo-${id} { animation: ${andando ? `vp-anda-${id} .9s` : `vp-respira-${id} 3.4s`} ease-in-out infinite; }
        .vp-gota-${id} { animation: vp-gota-${id} .95s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .vp-corpo-${id}, .vp-gota-${id} { animation: none } }
      `}</style>

      <ellipse cx="66" cy="96" rx="62" ry="70" fill={g("aura")} />
      {abrigo && (
        <g>
          {/* marquise: ele se protege, não fica no aberto */}
          <path d="M26 4 L128 -8 L128 2 L26 14 Z" fill="#2b2b33" />
          <path d="M26 14 L128 2" stroke={g("ouro")} strokeWidth="2.4" />
          <rect x="116" y="2" width="5" height="164" fill="#24242b" />
          {[[6, 20], [14, 52], [20, 84], [8, 112], [17, 138], [4, 70]].map(([x, y], i) => (
            <line key={i} className={`vp-gota-${id}`} x1={x} y1={y} x2={x! - 2} y2={y! + 10} stroke="#5B9BFF" strokeWidth="1.6" strokeLinecap="round" style={{ animationDelay: `${i * 0.16}s`, opacity: 0.7 }} />
          ))}
        </g>
      )}
      <ellipse cx="64" cy="164" rx="34" ry="5" fill="#000" opacity=".5" />

      <g className={`vp-corpo-${id}`}>
        {/* pernas (andando: uma à frente) */}
        <g transform={andando ? "rotate(9 56 112)" : undefined}>
          <path d="M50 108 L48 152 Q48 155 51 155 L59 155 Q61 155 61 152 L62 110 Z" fill={g("calca")} />
          <path d="M42 154 Q43 149 50 149 L60 149 Q63 150 63 156 L63 159 L42 159 Q40 159 42 154 Z" fill="#F4F1EA" />
          <rect x="41" y="157.5" width="22.5" height="2.6" rx="1.3" fill={g("ouro")} />
        </g>
        <g transform={andando ? "rotate(-12 70 112)" : undefined}>
          <path d="M66 110 L67 152 Q67 155 70 155 L77 155 Q80 155 80 152 L77 108 Z" fill={g("calca")} />
          <path d="M66 154 Q67 149 74 149 L83 149 Q87 150 87 156 L87 159 L66 159 Q64 159 66 154 Z" fill="#ECE8DF" />
          <rect x="65" y="157.5" width="22.5" height="2.6" rx="1.3" fill={g("ouro")} />
        </g>
        {/* bolso da cargo */}
        <rect x="49" y="124" width="9" height="10" rx="2" fill="#141418" opacity=".7" />

        {/* moletom (ou puffer no frio) */}
        <path d={frio ? "M36 66 Q38 54 52 53 L72 53 Q86 54 88 66 L90 110 Q62 118 34 110 Z" : "M40 66 Q42 56 53 55 L71 55 Q82 56 84 66 L86 108 Q62 115 38 108 Z"} fill={g("roupa")} />
        {frio && [70, 82, 94].map((y) => <path key={y} d={`M37 ${y} Q62 ${y + 5} 88 ${y}`} stroke="#3a3a42" strokeWidth="1.4" fill="none" />)}
        {!frio && <path d="M50 92 L74 92 L76 104 L48 104 Z" fill="#131317" opacity=".65" />}
        {/* cordão amarelo */}
        {!frio && <><path d="M56 60 Q55 68 55.5 76" stroke={g("ouro")} strokeWidth="1.8" fill="none" strokeLinecap="round" /><path d="M66 60 Q67 68 66.5 76" stroke={g("ouro")} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <circle cx="55.5" cy="77.5" r="1.8" fill={g("ouro")} /><circle cx="66.5" cy="77.5" r="1.8" fill={g("ouro")} /></>}

        {/* isopor na alça (no abrigo, no chão) */}
        <path d={abrigo ? "M74 58 L94 140" : "M74 58 L34 92"} stroke={g("ouro")} strokeWidth="3" strokeLinecap="round" opacity={abrigo ? 0 : 1} />
        <g transform={abrigo ? "translate(76 54)" : andando ? "translate(-2 -4)" : undefined}>
          <rect x="16" y="88" width="32" height="25" rx="5" fill={g("isopor")} />
          <rect x="14" y="85" width="36" height="7" rx="3.5" fill={g("ouro")} />
          <path d="M27 104 L37 99 L34 108 L33 103.5 Z" fill="#1d1d21" opacity=".55" />
        </g>
        {/* braço esquerdo */}
        <path d={abrigo ? "M43 66 Q36 80 52 88" : "M43 66 Q35 80 34 95"} stroke={g("roupa")} strokeWidth="10" strokeLinecap="round" fill="none" />
        <circle cx={abrigo ? 53 : 34} cy={abrigo ? 88 : 97} r="4.6" fill={g("pele")} />

        {/* pescoço e cabeça */}
        <rect x="56" y="47" width="10" height="9" rx="3" fill={g("pele")} />
        {capuz && <path d="M43 44 Q43 20 61 19 Q79 20 79 44 Q79 56 61 58 Q43 56 43 44 Z" fill={g("roupa")} />}
        <circle cx="61" cy="38" r="13.5" fill={g("pele")} />
        <path d="M74 38 Q77 39 76 42" stroke="#6e4027" strokeWidth="1.6" fill="none" />
        {!capuz && !frio && !sol && <path d="M47.5 36 Q48 24 61 24 Q74 24 74.5 36 Q70 30 61 30 Q52 30 47.5 36 Z" fill="#141210" />}
        {/* rosto */}
        {sol ? (
          <g><rect x="50" y="34" width="9.5" height="6" rx="3" fill="#0b0b0d" /><rect x="62.5" y="34" width="9.5" height="6" rx="3" fill="#0b0b0d" />
            <path d="M59.5 36.5 L62.5 36.5" stroke="#0b0b0d" strokeWidth="1.4" /><path d="M52 35.5 L55 35.5" stroke="#F5B800" strokeWidth="1" strokeLinecap="round" opacity=".8" /></g>
        ) : (
          <g><path d="M52.5 33.5 Q55 32 57.5 33.5" stroke="#2a1a10" strokeWidth="1.5" fill="none" strokeLinecap="round" /><path d="M64.5 33.5 Q67 32 69.5 33.5" stroke="#2a1a10" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <circle cx="55.2" cy="37.5" r="1.7" fill="#17110c" /><circle cx="66.8" cy="37.5" r="1.7" fill="#17110c" /></g>
        )}
        <path d={abrigo ? "M57 45.5 Q61 44 65 45.5" : "M56.5 44 Q61 47.5 65.5 44"} stroke="#3a2215" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* chapéus */}
        {sol && <g><path d="M47 33 Q47 21 61 21 Q75 21 75 33 Z" fill="#141416" /><path d="M72 31 Q83 30 89 34 L74 35 Z" fill="#141416" /><path d="M57 27.5 L66 23 L63 30 L61.5 26.5 Z" fill={g("ouro")} /></g>}
        {frio && <g><path d="M47 34 Q47 19 61 19 Q75 19 75 34 Z" fill="#1d1d22" /><rect x="46" y="30" width="30" height="5.5" rx="2.6" fill={g("ouro")} /><circle cx="61" cy="18" r="3.2" fill="#1d1d22" /></g>}
        {frio && <path d="M48 52 Q61 60 74 52 L74 58 Q61 66 48 58 Z M64 57 L69 72 L62 72 Z" fill={g("ouro")} />}

        {/* braço direito: guarda-chuva / garrafinha / balanço do passo / mãos no abrigo */}
        {chuva ? (
          <g>
            <path d="M80 66 Q90 56 92 42" stroke={g("roupa")} strokeWidth="10" strokeLinecap="round" fill="none" />
            <circle cx="92" cy="41" r="4.6" fill={g("pele")} />
            <line x1="92" y1="42" x2="92" y2="2" stroke="#d6d0c4" strokeWidth="2" />
            <path d="M40 8 Q92 -34 130 8 Q118 3 107 8 Q96 2 85 8 Q74 2 63 8 Q52 3 40 8 Z" fill="#18181c" />
            <path d="M40 8 Q52 3 63 8 Q74 2 85 8 Q96 2 107 8 Q118 3 130 8" stroke={g("ouro")} strokeWidth="2" fill="none" />
            <circle cx="92" cy="-12" r="2" fill={g("ouro")} />
            {[30, 48, 112, 126].map((x, i) => (
              <line key={x} className={`vp-gota-${id}`} x1={x} y1="14" x2={x - 1.5} y2="22" stroke="#5B9BFF" strokeWidth="1.7" strokeLinecap="round" style={{ animationDelay: `${i * 0.24}s` }} />
            ))}
          </g>
        ) : abrigo ? (
          <g><path d="M79 66 Q86 80 70 88" stroke={g("roupa")} strokeWidth="10" strokeLinecap="round" fill="none" /><circle cx="69" cy="88" r="4.6" fill={g("pele")} /></g>
        ) : (
          <g transform={andando ? "rotate(-18 80 64)" : undefined}>
            <path d="M80 66 Q88 80 88 95" stroke={g("roupa")} strokeWidth="10" strokeLinecap="round" fill="none" />
            <circle cx="88" cy="97" r="4.6" fill={g("pele")} />
            {sol && <g><rect x="85" y="96" width="7" height="15" rx="2.5" fill="#9CC4FF" opacity=".85" /><rect x="85.5" y="93.5" width="6" height="3.5" rx="1.2" fill={g("ouro")} /></g>}
          </g>
        )}
        {andando && <g stroke="#F5B800" strokeWidth="1.6" strokeLinecap="round" opacity=".55"><line x1="6" y1="96" x2="20" y2="96" /><line x1="2" y1="108" x2="14" y2="108" /><line x1="8" y1="120" x2="18" y2="120" /></g>}
      </g>
    </svg>
  );
}
