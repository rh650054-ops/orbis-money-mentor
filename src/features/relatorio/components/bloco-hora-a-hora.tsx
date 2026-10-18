import { cn } from "@/shared/lib/utils";
import type { Resumo } from "../lib/derivar";
import { brl } from "../lib/periodo";
import { Cartao, Fato, Frase, Secao } from "./ui-bits";

/** Hora a hora as four periods of the day (big tiles, thumb-friendly) and the shape of
 *  the hours below, with no touch needed. Rick (18/10): the 16 small squares were
 *  "muito confuso… usuários com dedos maiores podem apertar errado". */
export function BlocoHoraAHora({ r }: { r: Resumo }) {
  const { periodos, melhorPeriodo, shareMelhor, barras, melhorHora, piorHora } = r.horas;
  if (!melhorPeriodo) return null;
  const max = Math.max(1, ...barras.map((b) => b.valor));
  const nomeHora = melhorPeriodo.nome === "Almoço" ? "na hora do almoço" : melhorPeriodo.nome === "Manhã" ? "de manhã" : melhorPeriodo.nome === "Tarde" ? "à tarde" : "à noite";
  return (
    <Secao kicker="Hora a hora">
      <Cartao className="orbis-num">
        <Frase>Você vende mais <b>{nomeHora}</b>: {melhorPeriodo.faixa} deram {shareMelhor >= 45 ? "quase metade" : `${shareMelhor}%`} do que vendeu.</Frase>

        <div className="grid grid-cols-2 gap-2">
          {periodos.map((p) => {
            const best = p === melhorPeriodo;
            return (
              <div key={p.nome} className={cn("min-h-[92px] rounded-2xl border p-3", best ? "border-[rgba(245,184,0,.45)] bg-[var(--orbis-gold-soft)]" : "border-transparent bg-secondary")}>
                <div className={cn("flex justify-between text-[12px] font-bold uppercase tracking-[.06em]", best ? "text-primary" : "text-muted-foreground")}>
                  <span>{p.nome}</span><span>{p.faixa}</span>
                </div>
                <div className="mt-1.5 text-[22px] font-bold tracking-tight">{brl(p.valor)}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">
                  <b className="font-semibold text-foreground">{p.vendas}</b> vendas{p.conv != null ? <> · <b className="font-semibold text-foreground">{p.conv}%</b></> : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid h-[46px] items-end gap-[3px]" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }} aria-hidden>
          {barras.map((b) => (
            <i key={b.h} className="block min-h-[3px] rounded-t-[3px]" style={{ height: `${Math.max(6, Math.round((b.valor / max) * 100))}%`, background: melhorHora?.h === b.h ? "var(--orbis-gold)" : "#3a3a3a" }} />
          ))}
        </div>
        <div className="mt-1 grid gap-[3px] text-center text-[10px] text-muted-foreground/70" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }} aria-hidden>
          {barras.map((b) => <span key={b.h}>{b.h % 2 === 0 ? `${b.h}h` : ""}</span>)}
        </div>

        {melhorHora && (
          <Fato>
            Melhor hora: <b>{melhorHora.h}h</b>, {brl(melhorHora.valor)} em {melhorHora.vendas} vendas
            {piorHora && piorHora.h !== melhorHora.h ? <> · Mais fraca: <b>{piorHora.h}h</b>, {brl(piorHora.valor)}</> : null}.
          </Fato>
        )}
      </Cartao>
    </Secao>
  );
}
