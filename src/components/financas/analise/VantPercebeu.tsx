/* 2 · VANT PERCEBEU — um comportamento fora do padrão, no máximo duas linhas.
   Coral só no ícone. Se o alerta é a mesma categoria que já abre a lista,
   pega o próximo (a tela não fala a mesma coisa duas vezes); sem nada, some. */
import { ChevronRight, TrendingUp } from "lucide-react";
import { COR, Cartao, Rotulo } from "../planejar/ui";
import { reais, type Alerta } from "./tipos";

/** 02/11: with a teto the card talks about the teto (R$ X de R$ Y), never "passando do teto"
 *  while it is not; without one it compares with the usual pace. */
export function VantPercebeu({ alerta, corrente, teto, onVer }: { alerta: Alerta; corrente: boolean; teto?: number; onVer: () => void }) {
  const comTeto = teto != null && teto > 0;
  const passou = comTeto && alerta.total > teto;
  const titulo = !comTeto ? "acima do seu normal" : passou ? "passou do teto" : `já usou ${Math.round((alerta.total / teto) * 100)}% do teto`;
  const linha = comTeto
    ? `${reais(alerta.total)} de ${reais(teto)}${corrente ? " até hoje" : " no mês"}`
    : `${reais(alerta.total)} ${corrente ? "até hoje" : "no mês"} · esperado ${reais(alerta.esperado)}`;
  return (
    <Cartao className="p-0">
      <button type="button" onClick={onVer}
        className="group w-full text-left p-4 flex gap-3 rounded-[18px] transition-[transform,background-color] duration-[120ms] active:scale-[0.99] active:bg-white/[.05]">
        <span className="w-9 h-9 shrink-0 rounded-[11px] flex items-center justify-center" style={{ background: "rgba(255,107,94,.12)" }} aria-hidden>
          <TrendingUp className="w-5 h-5" strokeWidth={2} style={{ color: COR.coral }} />
        </span>
        <span className="flex-1 min-w-0">
          <Rotulo cor={COR.sub}>Vant percebeu</Rotulo>
          <span className="block text-[17px] font-bold leading-snug mt-1" style={{ color: COR.texto }}>
            {alerta.rotulo} {comTeto ? titulo : `está ${titulo}`}
          </span>
          <span className="block text-[13px] mt-1 tabular-nums" style={{ color: COR.sub }}>
            {linha}
          </span>
          <span className="inline-flex items-center gap-0.5 mt-2 text-[14px] font-extrabold" style={{ color: COR.ouro }}>
            Ver por quê <ChevronRight className="w-4 h-4 transition-transform duration-[120ms] group-active:translate-x-0.5" strokeWidth={2.6} />
          </span>
        </span>
      </button>
    </Cartao>
  );
}
