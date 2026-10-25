/* Example ranking: verified sellers (bank-checked) vs one who only typed the value.
   Fictitious people and values, stated in the footer. */
import { useState } from "react";
import { COR } from "@/shared/components/vant-ui";
import { reaisInteiros, useApareceu, useContador, useIntervalo } from "./use-vitrine-motion";

const LINHAS = [
  { nome: "Ana Souza", foto: "/ranking-exemplo/ana.svg", valor: 640, vf: true, chip: "+ R$ 12 Pix" },
  { nome: "Diego Lima", foto: "/ranking-exemplo/diego.svg", valor: 612, vf: false, chip: "" },
  { nome: "Marcos Reis", foto: "/ranking-exemplo/marcos.svg", valor: 585, vf: true, chip: "+ R$ 15 Pix" },
];

function Linha({ l, pos, visto, pulso }: { l: (typeof LINHAS)[number]; pos: number; visto: boolean; pulso: number }) {
  const v = useContador(l.valor, visto, 1200);
  return (
    <div className="relative grid grid-cols-[22px_44px_1fr_auto] gap-2.5 items-center py-2.5 px-1 transition-all duration-500"
      style={{ borderTop: pos > 1 ? "1px solid #1b1a17" : undefined, opacity: visto ? 1 : 0, transform: visto ? "none" : "translateY(14px)", transitionDelay: `${300 + (pos - 1) * 350}ms` }}>
      <span className="text-[22px] font-black text-center" style={{ color: "#FFC800" }}>{pos}</span>
      <span key={`a${l.vf ? pulso : 0}`} className={`relative w-11 h-11 rounded-full ${l.vf && pulso > 0 ? "vv-pulso" : ""}`}>
        {pos === 1 && <span aria-hidden className="absolute -top-[11px] left-1/2 -ml-[9px] text-[15px]" style={{ filter: "drop-shadow(0 0 6px rgba(255,200,0,.8))" }}>👑</span>}
        <img src={l.foto} alt="" width={44} height={44} className="w-11 h-11 rounded-full" style={{ boxShadow: l.vf ? "0 0 0 2px #0095F6" : undefined }} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center text-[13.5px] font-extrabold">{l.nome}
          {l.vf && <span className="ml-1.5 w-4 h-4 rounded-full grid place-items-center text-[9.5px] text-white transition-transform duration-500" style={{ background: "#0095F6", boxShadow: "0 0 10px rgba(0,149,246,.8)", transform: visto ? "scale(1)" : "scale(0)", transitionDelay: `${1300 + (pos - 1) * 350}ms` }}>✓</span>}
        </span>
        <span className="block text-[10.5px] font-bold" style={{ color: l.vf ? "#4FB3FF" : COR.apagado }}>{l.vf ? "conferido pelo banco" : "valor lançado, sem conferência"}</span>
      </span>
      <span className="text-right text-[20px] font-black tabular-nums leading-none" style={{ color: l.vf ? COR.texto : COR.suave }}>
        {reaisInteiros(v)}
        <span className="block text-[9.5px] font-extrabold tracking-[.06em] mt-0.5" style={{ color: l.vf ? COR.ok : "#c9a14a" }}>{l.vf ? "CAIU NO BANCO" : "LANÇADO"}</span>
      </span>
      {l.chip && pulso > 0 && <span key={`c${pulso}`} aria-hidden className="vv-sobe absolute right-2 top-0.5 text-[10px] font-black rounded-full px-1.5 py-0.5 opacity-0" style={{ color: COR.ok, background: "rgba(61,214,140,.12)" }}>{l.chip}</span>}
    </div>
  );
}

export function VitrineRanking() {
  const [ref, visto] = useApareceu<HTMLDivElement>();
  const [pulso, setPulso] = useState(0);
  useIntervalo(() => setPulso((p) => p + 1), 4500, visto);
  return (
    <div ref={ref} className="rounded-[20px] px-3 pt-2 pb-3" style={{ background: COR.card, border: `1px solid ${COR.borda}` }}>
      {LINHAS.map((l, i) => <Linha key={l.nome} l={l} pos={i + 1} visto={visto} pulso={pulso} />)}
      <p className="text-[10.5px] mt-2 leading-snug" style={{ color: COR.apagado }}>
        Com o <b style={{ color: "#4FB3FF" }}>✓ Verificado</b>, todo mundo sabe que o seu número é real. Pessoas e valores fictícios.
      </p>
    </div>
  );
}
