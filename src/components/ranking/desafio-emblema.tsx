/* Metallic medallion for the Desafio Avante panel: crown (month) or lightning coin (week).
   Pure CSS "3D": conic rim, lit inner face, floor glow, twinkling sparkles. */
import { Crown, Zap } from "lucide-react";
import type { Aba } from "./premiacao";
import { rgba, type TemaDesafio } from "./desafio-tema";

const FAISCAS: [number, number, number, number][] = [[-58, -18, 7, 0], [56, -30, 5, 0.8], [-44, 34, 4, 1.6], [62, 22, 6, 2.3]];

export function DesafioEmblema({ aba, tema }: { aba: Aba; tema: TemaDesafio }) {
  const Icone = aba === "mensal" ? Crown : Zap;
  return (
    <div className="relative w-[112px] h-[112px] flex items-center justify-center">
      {/* halo + chão iluminado */}
      <span aria-hidden="true" className="absolute inset-[-18px] rounded-full" style={{ background: `radial-gradient(circle, ${rgba(tema, 0.45)} 0%, transparent 65%)` }} />
      <span aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 bottom-[-10px] w-[120px] h-[18px] rounded-[50%]" style={{ background: `radial-gradient(ellipse, ${rgba(tema, 0.55)} 0%, transparent 70%)`, filter: "blur(2px)" }} />
      {FAISCAS.map(([x, y, s, d], i) => (
        <span key={i} aria-hidden="true" className="vant-faisca absolute left-1/2 top-1/2"
          style={{ width: s, height: s, transform: `translate(${x}px,${y}px) rotate(45deg)`, background: tema.claro, boxShadow: `0 0 8px ${tema.claro}`, animationDelay: `${d}s` }} />
      ))}
      <div className="orbis-float relative">
      <div className="vant-estoura relative w-[92px] h-[92px] rounded-full p-[4px]"
        style={{ background: `conic-gradient(from 210deg, ${tema.claro}, ${tema.cor}, ${tema.escuro}, ${tema.cor}, ${tema.claro}, ${tema.escuro}, ${tema.claro})`, boxShadow: `0 0 34px ${rgba(tema, 0.6)}, 0 10px 24px rgba(0,0,0,.6)` }}>
        <div className="w-full h-full rounded-full flex items-center justify-center"
          style={{ background: `radial-gradient(circle at 34% 28%, ${rgba(tema, 0.55)} 0%, ${tema.escuro} 48%, #050403 100%)`, boxShadow: "inset 0 2px 5px rgba(255,255,255,.35), inset 0 -8px 14px rgba(0,0,0,.6)" }}>
          <Icone className="w-11 h-11" style={{ color: "#fff", filter: `drop-shadow(0 0 10px ${rgba(tema, 0.95)})` }} fill={tema.claro} strokeWidth={1.2} />
        </div>
      </div>
      </div>
    </div>
  );
}
