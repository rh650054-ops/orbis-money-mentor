import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import type { Resumo } from "../lib/derivar";
import { brl, ddmm, fmtMin, semanaCurta, semanaLonga } from "../lib/periodo";
import type { DiaLista } from "../lib/derivar";
import { Cartao, Fato, Frase, Secao } from "./ui-bits";

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** Dia a dia: the answer first ("seu melhor dia foi…"), the week as 7 big dots
 *  (≥ 44 px, for big thumbs) when the period is a week, a card for the tapped day,
 *  and the full list — nothing hidden. */
export function BlocoDiaADia({ r }: { r: Resumo }) {
  const { lista, melhor, maisEficiente, maisFraco, semana, maxCaiu } = r.dias;
  const [sel, setSel] = useState<string | null>(melhor?.dia ?? null);
  if (lista.length === 0) return null;
  const selRow = lista.find((d) => d.dia === sel) ?? null;

  return (
    <Secao kicker="Dia a dia" right={`${r.diasNaRua} ${r.diasNaRua === 1 ? "dia" : "dias"} na rua`}>
      <Cartao className="orbis-num">
        {melhor ? (
          <Frase>Seu melhor dia foi <b>{semanaLonga(melhor.dia)} {ddmm(melhor.dia)}</b>: {brl(melhor.vendido)} em {melhor.vendas} vendas{melhor.worked_min > 0 ? `, ${fmtMin(melhor.worked_min)} na rua` : ""}.</Frase>
        ) : <Frase>Ainda sem venda fechada nesse período.</Frase>}

        {semana && (
          <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Dias da semana">
            {semana.map((d) => {
              const vendido = d.row?.vendido ?? 0;
              const a = maxCaiu > 0 && vendido > 0 ? 0.18 + 0.82 * (vendido / maxCaiu) : 0;
              const ehMelhor = melhor?.dia === d.dia;
              return (
                <button key={d.dia} role="tab" aria-selected={sel === d.dia} aria-label={`${semanaCurta(d.dia)} ${ddmm(d.dia)}`}
                  className="orbis-press grid justify-items-center gap-1.5 bg-transparent p-0 text-muted-foreground"
                  onClick={() => setSel(d.dia)} disabled={!d.row}>
                  <span className={cn("grid aspect-square w-full max-w-12 place-items-center rounded-full border-2 border-transparent text-[15px] font-bold",
                      !d.row && "border-border text-muted-foreground/60", sel === d.dia && "border-foreground")}
                    style={d.row ? { background: a > 0 ? `rgba(245,184,0,${a.toFixed(2)})` : "hsl(var(--secondary))", color: a > 0.55 ? "#0a0a0a" : undefined } : undefined}>
                    {d.letra}
                  </span>
                  <small className={cn("text-[11px]", ehMelhor && "font-bold text-primary")}>{d.dia.slice(8, 10)}</small>
                </button>
              );
            })}
          </div>
        )}

        {selRow && (
          <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-2.5 rounded-2xl bg-secondary px-3.5 py-3">
            <div>
              <p className="text-[15px] font-bold">{cap(semanaCurta(selRow.dia))} {ddmm(selRow.dia)}</p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {selRow.worked_min > 0 ? `${fmtMin(selRow.worked_min)} na rua · ` : ""}{selRow.vendas} vendas{selRow.abordagens > 0 ? <> em {selRow.abordagens} abordagens · <b className="font-semibold text-foreground">{selRow.conv}%</b></> : null}
                {selRow.vendas > 0 ? ` · ticket ${brl(selRow.vendido / selRow.vendas, true)}` : ""}
              </p>
            </div>
            <span className="whitespace-nowrap text-[24px] font-bold text-primary">{brl(selRow.vendido)}</span>
          </div>
        )}

        <div className="mt-3">
          <div className="grid grid-cols-[76px_1fr_44px_70px] gap-2 pb-1 text-[11px] uppercase tracking-[.06em] text-muted-foreground/70">
            <span>Dia</span><span /><span className="text-right">Conv.</span><span className="text-right">Vendeu</span>
          </div>
          {lista.filter((d) => d.vendido > 0 || d.vendas > 0).map((d) => <LinhaDia key={d.dia} d={d} max={maxCaiu} melhor={melhor?.dia === d.dia} onClick={() => setSel(d.dia)} />)}
        </div>

        {(maisEficiente || maisFraco) && (
          <Fato>
            {maisEficiente && <>Mais eficiente: <b>{semanaCurta(maisEficiente.dia)} {ddmm(maisEficiente.dia)}</b>, {maisEficiente.conv}% de conversão</>}
            {maisEficiente && maisFraco && " · "}
            {maisFraco && <>Mais fraco: <b>{semanaCurta(maisFraco.dia)} {ddmm(maisFraco.dia)}</b>, {brl(maisFraco.vendido)}{maisFraco.worked_min > 0 ? ` em ${fmtMin(maisFraco.worked_min)}` : ""}</>}.
          </Fato>
        )}
      </Cartao>
    </Secao>
  );
}

function LinhaDia({ d, max, melhor, onClick }: { d: DiaLista; max: number; melhor: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("grid w-full grid-cols-[76px_1fr_44px_70px] items-center gap-2 border-t border-border/60 py-1.5 text-left text-[13px]", melhor && "text-primary")}>
      <span className="capitalize">{semanaCurta(d.dia)} {ddmm(d.dia)}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-secondary"><i className="orbis-fill block h-full rounded-full" style={{ width: `${max > 0 ? Math.round((d.vendido / max) * 100) : 0}%`, background: melhor ? "var(--orbis-gold)" : "#4a4a4a" }} /></span>
      <span className="text-right">{d.conv != null ? `${d.conv}%` : "—"}</span>
      <span className="text-right font-bold">{brl(d.vendido)}</span>
    </button>
  );
}
