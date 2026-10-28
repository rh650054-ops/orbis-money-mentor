import { Ring } from "@/shared/motion";
import type { Resumo } from "../lib/derivar";
import { brl, ddmm, dec1, fmtMinSeg, rotuloPeriodo } from "../lib/periodo";
import { COR, Cartao, Chip, Linha } from "./ui-bits";

/** "Vendas da semana" — the same statement shape as the money card: ring + sentence,
 *  then Abordou → Vendeu → Ritmo. Conversion = sales ÷ approaches over the period totals,
 *  never an average of daily percentages. Ritmo uses the time actually selling. */
export function CardVendas({ r }: { r: Resumo }) {
  const v = r.vendas;
  const conv = v.conv == null ? null : Math.round(v.conv);
  return (
    <Cartao className="orbis-num">
      <div className="flex items-baseline justify-between gap-2">
        <span className="orbis-section">Vendas {tituloCurto(r)}</span>
        <span className="text-xs text-muted-foreground">{rotuloPeriodo(r.periodo)}</span>
      </div>

      <div className="mt-2 grid grid-cols-[60px_1fr] items-center gap-3">
        <Ring pct={conv ?? 0} size={60} stroke={8} label={<span className="text-[16px] font-bold leading-none">{conv ?? "—"}<small className="text-[11px] font-semibold text-primary">%</small></span>} />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-snug [text-wrap:balance]">
            {conv == null ? "Marque as abordagens no Foco pra ver sua conversão" : <>Vendeu pra <b className="text-primary">{conv} de cada 100</b> que abordou</>}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted-foreground">
            {v.abordPorVenda != null && <span>1 venda a cada {v.abordPorVenda.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} abordagens</span>}
            <Chip delta={v.deltaConv} curto />
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Linha icone="👋" iconeCor={COR.cinzaClaro} titulo="Abordou"
          sub={`${Math.round(v.abordDia)} ${Math.round(v.abordDia) === 1 ? "pessoa" : "pessoas"} por dia${v.abordagemCadaMin ? ` · 1 a cada ${fmtMinSeg(v.abordagemCadaMin)}` : ""}`}
          valor={v.abordagens} valorCor={COR.fg2} />
        <Linha icone="✓" iconeCor={COR.ok} titulo="Vendeu"
          sub={`${dec1(v.vendasDia)} por dia${v.ticket ? ` · ticket ${brl(v.ticket, true)}` : ""}`}
          valor={v.vendas} valorCor={COR.ok} />
        <Linha icone="⏱" iconeCor={COR.gold} negrito titulo="Ritmo"
          sub={v.melhorRitmo ? `melhor: ${fmtMinSeg(v.melhorRitmo.min)} (${ddmm(v.melhorRitmo.dia)})` : "só o tempo vendendo"}
          valor={v.ritmoMin ? `${fmtMinSeg(v.ritmoMin)}/venda` : "—"} valorCor={COR.gold} />
      </div>
    </Cartao>
  );
}

function tituloCurto(r: Resumo) {
  switch (r.periodo.preset) {
    case "hoje": return "de hoje";
    case "ontem": return "de ontem";
    case "semana": return "da semana";
    case "mes": return "do mês";
    default: return "do período";
  }
}
