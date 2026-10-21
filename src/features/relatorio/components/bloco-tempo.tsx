import type { Resumo } from "../lib/derivar";
import { ddmm, fmtMin, semanaCurta } from "../lib/periodo";
import { BarraDividida, COR, Cartao, DoisGrandes, Fato, Frase, Secao } from "./ui-bits";

/** Seu tempo: one sentence, two big numbers, one split bar, three lines with the value
 *  big on the right. "Parado" = beyond 20 min between one sale and the next inside the
 *  Foco, minus declared pauses (see migration 20261018150000). */
export function BlocoTempo({ r }: { r: Resumo }) {
  const t = r.tempo;
  if (t.worked <= 0) return null;
  const deCada10 = Math.round((t.ativo / t.worked) * 10);
  const pausasTxt = t.pausas.map((p) => `${p.motivo} ${fmtMin(p.min)}`).join(" · ");
  return (
    <Secao kicker="Seu tempo" right={`${fmtMin(t.worked)} na rua`}>
      <Cartao className="orbis-num">
        <Frase>De cada 10 minutos na rua, <b>{deCada10} {deCada10 === 1 ? "foi" : "foram"} vendendo</b>.</Frase>
        <DoisGrandes itens={[
          { valor: fmtMin(t.porDia), rotulo: r.umDia ? "na rua" : "por dia na rua" },
          { valor: `${t.pctAtivo}%`, rotulo: "vendendo", cor: COR.ok },
        ]} />
        <BarraDividida className="mt-3" partes={[{ pct: t.pctAtivo, cor: COR.ok }, { pct: t.pctPausa, cor: COR.pausa }, { pct: t.pctParado, cor: COR.cinza }]} />
        <div className="mt-2.5">
          <LinhaTempo cor={COR.ok} titulo="Vendendo" valor={fmtMin(t.ativo)} valorCor={COR.ok} />
          <LinhaTempo cor={COR.pausa} titulo="Pausas" sub={pausasTxt || "nenhuma"} valor={fmtMin(t.pausa)} />
          <LinhaTempo cor={COR.cinza} titulo="Parado" sub="+20 min sem venda" valor={fmtMin(t.parado)} />
        </div>
        {!r.umDia && t.maior && (
          <Fato>
            Dia mais longo: <b>{semanaCurta(t.maior.dia)} {ddmm(t.maior.dia)}</b>, {fmtMin(t.maior.min)}
            {t.menor && t.menor.dia !== t.maior.dia ? <> · mais curto: <b>{semanaCurta(t.menor.dia)} {ddmm(t.menor.dia)}</b>, {fmtMin(t.menor.min)}</> : null}.
          </Fato>
        )}
      </Cartao>
    </Secao>
  );
}

function LinhaTempo({ cor, titulo, sub, valor, valorCor }: { cor: string; titulo: string; sub?: string; valor: string; valorCor?: string }) {
  return (
    <div className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2 border-t border-border/60 py-1.5 first:border-t-0">
      <i className="h-3 w-3 rounded-[3px]" style={{ background: cor }} />
      <span className="min-w-0 text-[13.5px] font-semibold">
        {titulo}
        {sub ? <small className="block truncate text-[11px] font-normal text-muted-foreground">{sub}</small> : null}
      </span>
      <span className="whitespace-nowrap text-[15px] font-bold" style={{ color: valorCor }}>{valor}</span>
    </div>
  );
}
