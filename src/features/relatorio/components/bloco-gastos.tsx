import type { Resumo } from "../lib/derivar";
import { brl, rotuloAnterior } from "../lib/periodo";
import { BarraDividida, COR, Cartao, Chip, Frase, Secao } from "./ui-bits";

const TONS = [COR.custo, COR.cinzaClaro, COR.cinza, "#2a2a2a"];

/** Seus gastos: one accent only — the biggest category (usually mercadoria) in
 *  cost-red, the rest in greys (Rick, 18/10: v9 "ficou muito colorido"). */
export function BlocoGastos({ r }: { r: Resumo }) {
  const g = r.gastos;
  if (g.total <= 0) return null;
  const linhas = [...g.linhas].sort((a, b) => b.valor - a.valor);
  const maior = linhas[0];
  return (
    <Secao kicker="Seus gastos" right={brl(g.total)}>
      <Cartao className="orbis-num">
        <Frase>
          Você gastou <b className="!text-[var(--orbis-custo)]">{brl(g.total)}</b> pra vender {brl(r.dinheiro.vendeu)} — {brl(g.deCada10, true)} de cada R$ 10.
          {maior && maior.pctTotal >= 60 ? <> Quase tudo foi <b className="!text-[var(--orbis-custo)]">{maior.nome.toLowerCase()}</b>.</> : null}
        </Frase>
        <BarraDividida partes={linhas.map((l, i) => ({ pct: l.pctTotal, cor: TONS[i] ?? TONS[3]! }))} />
        <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(3, linhas.length)}, minmax(0, 1fr))` }}>
          {linhas.map((l, i) => (
            <div key={l.chave} className="grid gap-0.5 rounded-xl bg-secondary px-2.5 pb-2 pt-2" style={{ borderTop: `3px solid ${TONS[i] ?? TONS[3]}` }}>
              <span className="text-[11.5px] font-bold tracking-[.02em]" style={{ color: i === 0 ? COR.custo : COR.fg2 }}>{l.nome}</span>
              <b className="text-[19px] font-bold tracking-tight" style={{ color: i === 0 ? COR.custo : undefined }}>{brl(l.valor)}</b>
              <small className="text-[11px] text-muted-foreground">{l.pctTotal}%{r.umDia ? "" : ` · ${brl(l.porDia)}/dia`}</small>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-[13px] text-muted-foreground">
          <span>
            {!r.umDia ? <>{brl(g.porDia)} por dia na rua</> : null}
            {g.deCada10Anterior != null ? <>{!r.umDia ? " · " : ""}{rotuloAnterior(r.periodo)}: <b className="font-semibold text-foreground">{brl(g.deCada10Anterior, true)}</b> por R$ 10</> : null}
          </span>
          <Chip delta={g.deltaDeCada10} />
        </div>
      </Cartao>
    </Secao>
  );
}
