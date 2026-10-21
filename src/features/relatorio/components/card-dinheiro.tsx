import { AnimatedNumber } from "@/shared/motion";
import type { Resumo } from "../lib/derivar";
import { brl, fmtMin, tituloDinheiro, rotuloPeriodo } from "../lib/periodo";
import { BarraDividida, COR, Cartao, Chip, Linha } from "./ui-bits";

/**
 * The card people screenshot and post (Rick, 18/10: "lá em cima quero resumo pra
 * tirar print"). One number big (what already fell into the pocket), then the money
 * read like a bank statement: Vendeu → Caiu no bolso → Gastou → Sobrou pra você.
 * Costs opened by category and the calote detail live further down the page.
 */
export function CardDinheiro({ r }: { r: Resumo }) {
  const d = r.dinheiro;
  return (
    <Cartao dourado className="orbis-num">
      <div className="flex items-baseline justify-between gap-2">
        <span className="orbis-label text-[11px] font-bold uppercase tracking-[.1em]">{tituloDinheiro(r.periodo)}</span>
        <span className="text-xs text-muted-foreground">{rotuloPeriodo(r.periodo)}</span>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <AnimatedNumber value={d.caiu} format={(n) => brl(n)} className="block text-[28px] font-bold leading-none tracking-tight" />
          <div className="mt-1 text-[11.5px] text-muted-foreground">
            já caiu no seu bolso{d.vendeu > 0 ? <> · <b className="font-semibold text-foreground">{d.pctCaiu}%</b> do que vendeu</> : null}
          </div>
        </div>
        <Chip delta={d.delta} curto />
      </div>

      <div className="mt-3">
        <Linha icone="=" iconeCor={COR.cinzaClaro} titulo="Vendeu" sub={`${d.vendas} ${d.vendas === 1 ? "venda" : "vendas"}${r.tempo.worked > 0 ? ` · ${fmtMin(r.tempo.worked)} na rua` : ""}`} valor={brl(d.vendeu)} valorCor={COR.fg2} />
        <Linha icone="↓" iconeCor={COR.ok} titulo="Caiu no bolso" sub="Pix + dinheiro + cartão" valor={brl(d.caiu)} valorCor={COR.ok} />
        <Linha icone="−" iconeCor={COR.custo} titulo="Gastou" sub="mercadoria, transporte, comida" valor={`− ${brl(d.gastos)}`} valorCor={COR.custo} />
        <Linha icone="★" iconeCor={COR.gold} negrito titulo="Sobrou pra você"
          sub={d.vendeu > 0 ? `${brl(d.deCada10, true)} de cada R$ 10` : "nada lançado ainda"}
          valor={brl(d.sobrou)} valorCor={COR.gold} valorGrande />
      </div>

      {d.vendeu > 0 && (
        <>
          <BarraDividida className="mt-3" altura={10} partes={[{ pct: d.pctSobrou, cor: COR.gold }, { pct: d.pctGastou, cor: COR.custo }, { pct: d.pctNaoCaiu, cor: COR.cinza }]} />
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span><b className="font-semibold text-foreground">Sobrou</b> {d.pctSobrou}%</span>
            <span><b className="font-semibold text-foreground">Gastou</b> {d.pctGastou}%</span>
            <span><b className="font-semibold text-foreground">Não caiu</b> {d.pctNaoCaiu}%</span>
          </div>
        </>
      )}
    </Cartao>
  );
}
