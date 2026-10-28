import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import type { Resumo } from "../lib/derivar";
import { brl } from "../lib/periodo";
import { Cartao, Fato, Frase, Secao } from "./ui-bits";

/** Hora a hora as four periods of the day (big tiles, thumb-friendly) and the shape of
 *  the hours below, with no touch needed. Rick (18/10): the 16 small squares were
 *  "muito confuso… usuários com dedos maiores podem apertar errado". */
export function BlocoHoraAHora({ r }: { r: Resumo }) {
  const { periodos, melhorPeriodo, shareMelhor, barras, melhorHora, piorHora } = r.horas;
  // Rick (19/10): o gráfico das horas volta grande e dá pra tocar numa hora
  const [hora, setHora] = useState<number | null>(null);
  if (!melhorPeriodo) return null;
  const sel = hora != null ? barras.find((b) => b.h === hora) ?? null : null;
  const max = Math.max(1, ...barras.map((b) => b.valor));
  const nomeHora = melhorPeriodo.nome === "Almoço" ? "na hora do almoço" : melhorPeriodo.nome === "Manhã" ? "de manhã" : melhorPeriodo.nome === "Tarde" ? "à tarde" : melhorPeriodo.nome === "Cedo" ? "cedo, antes das 8h" : "à noite";
  // 27/10: "quase metade" was shown for anything from 45% to 100%
  const parte = shareMelhor >= 45 && shareMelhor <= 55 ? `quase metade (${shareMelhor}%)` : `${shareMelhor}%`;
  return (
    <Secao kicker="Hora a hora">
      <Cartao className="orbis-num">
        <Frase>Você vende mais <b>{nomeHora}</b>: {melhorPeriodo.faixa} deram {parte} do que você vendeu no Foco.</Frase>

        <div className="grid grid-cols-2 gap-2">
          {periodos.map((p, i) => {
            const best = p === melhorPeriodo;
            return (
              <div key={p.nome} className={cn("min-h-[92px] rounded-2xl border p-3", periodos.length % 2 === 1 && i === 0 && "col-span-2", best ? "border-[rgba(245,184,0,.45)] bg-[var(--orbis-gold-soft)]" : "border-transparent bg-secondary")}>
                <div className={cn("flex justify-between text-[12px] font-bold uppercase tracking-[.06em]", best ? "text-primary" : "text-muted-foreground")}>
                  <span>{p.nome}</span><span>{p.faixa}</span>
                </div>
                <div className="mt-1 text-[18px] font-bold tracking-tight">{brl(p.valor)}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">
                  <b className="font-semibold text-foreground">{p.vendas}</b> vendas{p.conv != null ? <> · <b className="font-semibold text-foreground">{p.conv}%</b></> : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid h-[140px] items-end gap-[3px]" style={{ gridTemplateColumns: `repeat(${barras.length}, minmax(0, 1fr))` }}>
          {barras.map((b) => {
            const aceso = (hora ?? melhorHora?.h) === b.h;
            return (
              <button key={b.h} type="button" onClick={() => setHora(hora === b.h ? null : b.h)} aria-label={`${b.h}h: ${brl(b.valor)}`}
                className="orbis-press flex h-full flex-col justify-end">
                <i className="block min-h-[3px] w-full rounded-t-[3px]" style={{ height: `${Math.max(4, Math.round((b.valor / max) * 100))}%`, background: aceso ? "var(--orbis-gold)" : "#3a3a3a" }} />
              </button>
            );
          })}
        </div>
        <div className="mt-1 grid gap-[3px] text-center text-[10px] text-muted-foreground/70" style={{ gridTemplateColumns: `repeat(${barras.length}, minmax(0, 1fr))` }} aria-hidden>
          {barras.map((b) => <span key={b.h}>{b.h % (barras.length > 16 ? 4 : 2) === 0 ? `${b.h}h` : ""}</span>)}
        </div>

        {sel && (
          <Fato><b>{sel.h}h às {sel.h + 1}h</b>: {brl(sel.valor)}{sel.valor > 0 ? "" : " — sem venda nessa hora"}.</Fato>
        )}
        {melhorHora && !sel && (
          <Fato>
            Melhor hora: <b>{melhorHora.h}h</b>, {brl(melhorHora.valor)} em {melhorHora.vendas} vendas
            {piorHora && piorHora.h !== melhorHora.h ? <> · Mais fraca: <b>{piorHora.h}h</b>, {brl(piorHora.valor)}</> : null}.
          </Fato>
        )}
      </Cartao>
    </Secao>
  );
}
