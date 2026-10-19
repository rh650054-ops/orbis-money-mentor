import type { Resumo } from "../lib/derivar";
import { brl } from "../lib/periodo";
import { BarraDividida, COR, Cartao, Fato, Frase, Secao } from "./ui-bits";

/** Calote: red = stayed lost, green = fell later (recovery rate). Opens with what the
 *  vendor actually lost; the two cards below show where it came from. When the period
 *  has no calote, a single green line. */
export function BlocoCalote({ r }: { r: Resumo }) {
  const c = r.calote;
  if (r.dinheiro.vendeu <= 0) return null;
  if (c.total <= 0) {
    return (
      <Secao kicker="Calote">
        <Cartao className="flex items-center gap-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[rgba(61,214,140,.14)] font-extrabold text-[var(--orbis-ok)]">✓</span>
          <span className="text-[14px] font-semibold">Sem calote no período <small className="font-normal text-muted-foreground">· tudo que vendeu caiu</small></span>
        </Cartao>
      </Secao>
    );
  }
  const pctPerdido = c.total > 0 ? Math.round((c.perdido / c.total) * 100) : 0;
  const vezes = c.vezesNormal;
  return (
    <Secao kicker="Calote" right="vendeu e não caiu">
      <Cartao className="orbis-num">
        <Frase>
          Você perdeu <b className="!text-[var(--orbis-calote)]">{brl(c.perdido)} em calote</b>
          {vezes != null && vezes >= 1.5 ? <> — {vezes >= 10 ? Math.round(vezes) : vezes.toString().replace(".", ",")}× o seu normal.</> : vezes != null && vezes <= 0.7 ? <> — abaixo do seu normal.</> : "."}
        </Frase>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-0.5 rounded-2xl border border-[rgba(255,92,92,.25)] bg-[rgba(255,92,92,.10)] px-3.5 py-3">
            <small className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--orbis-calote)]">Calote total</small>
            <b className="text-[28px] font-bold leading-none tracking-tight text-[var(--orbis-calote)]">{brl(c.total)}</b>
            <span className="text-[12px] text-muted-foreground">{c.unidades > 0 ? `${c.unidades} ${c.unidades === 1 ? "venda que não pagou" : "vendas que não pagaram"} na hora` : "vendido e não recebido"}</span>
          </div>
          <div className="grid gap-0.5 rounded-2xl border border-[rgba(61,214,140,.25)] bg-[rgba(61,214,140,.10)] px-3.5 py-3">
            <small className="text-[11px] font-bold uppercase tracking-[.06em] text-[var(--orbis-ok)]">Caiu depois</small>
            <b className="text-[28px] font-bold leading-none tracking-tight text-[var(--orbis-ok)]">{brl(c.recuperado)}</b>
            <span className="text-[12px] text-muted-foreground">{c.taxa ?? 0}% recuperado{c.peloBanco ? " · lido do banco" : " em Pix atrasado"}</span>
          </div>
        </div>
        <BarraDividida className="mt-3" partes={[{ pct: pctPerdido, cor: COR.calote }, { pct: 100 - pctPerdido, cor: COR.ok }]} />
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: COR.calote }} />Perdido {brl(c.perdido)} · {pctPerdido}%</span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: COR.ok }} />Recuperado {brl(c.recuperado)} · {100 - pctPerdido}%</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Mini valor={brl(c.porDia)} rotulo={r.umDia ? "perdido no dia" : "perdido por dia na rua"} />
          <Mini valor={c.umACada ? `1 a cada ${c.umACada}` : "—"} rotulo="vendas não pagou" />
          <Mini valor={`${Math.round(c.pctVendeu * 10) / 10}%`.replace(".", ",")} rotulo={<>do que vendeu · <em className="not-italic text-foreground">normal {Math.round(c.normalPct * 10) / 10}%</em></>} />
        </div>
        {c.peloBanco ? (
          <Fato>Lido do seu banco: o Pix que cai depois de fechar o Foco entra aqui sozinho e sai do perdido.</Fato>
        ) : (
          <Fato>Pix que cair depois, registra em <b>"Caiu mais dinheiro desse dia"</b> (no filtro do dia): ele sai do perdido e entra no recuperado.</Fato>
        )}
      </Cartao>
    </Secao>
  );
}

function Mini({ valor, rotulo }: { valor: string; rotulo: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary px-2.5 py-2">
      <b className="block whitespace-nowrap text-[16px] font-bold">{valor}</b>
      <span className="text-[11px] text-muted-foreground">{rotulo}</span>
    </div>
  );
}
