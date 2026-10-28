/* 2 · Resumo do mês: saiu, entrou, diferença — the first answer. */
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Cartao, COR } from "@/components/financas/planejar/ui";
import { ritmo, type Analise } from "@/components/financas/analise/tipos";
import type { ResumoRX } from "../types";
import { mesCurto, variacao } from "../lib/raiox";
import { inteiro } from "./pecas";

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-black tracking-[.14em]" style={{ color: COR.mute }}>{rotulo}</p>
      <p className="text-[17px] font-extrabold tabular-nums leading-tight whitespace-nowrap" style={{ color: cor }}>{valor}</p>
    </div>
  );
}

export function ResumoMes({ r, anterior, mesAnt, analise }: { r: ResumoRX; anterior: ResumoRX | null | undefined; mesAnt: string; analise?: Analise }) {
  const dif = r.entrou - r.saiu;
  // o "ritmo" da antiga aba Análise: gasto pessoal até hoje × o normal até hoje
  const rt = analise?.corrente ? ritmo(analise) : null;
  const v = anterior ? variacao(r.saiu, anterior.saiu) : null;
  return (
    <Cartao>
      <div className="grid grid-cols-3 gap-3">
        <Numero rotulo="SAIU" valor={inteiro(r.saiu)} cor={COR.texto} />
        <Numero rotulo="ENTROU" valor={inteiro(r.entrou)} cor={COR.verde} />
        <Numero rotulo="DIFERENÇA" valor={`${dif < 0 ? "− " : "+ "}${inteiro(Math.abs(dif))}`} cor={dif < 0 ? COR.coral : COR.verde} />
      </div>
      <div className="flex items-center justify-between gap-2 mt-3 text-[12.5px]">
        <span style={{ color: COR.mute }}>{r.lancamentos.toLocaleString("pt-BR")} movimentações · {r.bancos.length} {r.bancos.length === 1 ? "conta" : "contas"}</span>
        {v !== null && (
          <span className="inline-flex items-center gap-0.5 font-bold shrink-0" style={{ color: v > 5 ? COR.coral : v < -5 ? COR.verde : COR.sub }}>
            {v > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(v)}% de gastos vs {mesCurto(mesAnt)}
          </span>
        )}
      </div>
      {rt && (
        <p className="text-[12.5px] mt-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,.06)", color: rt.estado === "acima" ? COR.coral : rt.estado === "abaixo" ? COR.verde : COR.sub }}>
          Gasto pessoal {rt.estado === "igual" ? "no seu ritmo" : `${inteiro(Math.abs(rt.dif))} ${rt.estado === "acima" ? "acima" : "abaixo"} do seu ritmo`} até hoje
          {analise?.projecao ? <span style={{ color: COR.mute }}> · fecha o mês em ~{inteiro(analise.projecao)}</span> : null}
        </p>
      )}
    </Cartao>
  );
}
