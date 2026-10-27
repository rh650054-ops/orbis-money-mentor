/* The money of the mission: what to invoice per day, merchandise to buy, calote
   reserve, and what to produce beyond the stock. Big numbers, four tiles. */
import type { BaseLucro } from "../types";
import type { Cronograma } from "../lib/cronograma";
import { nomeUnidade } from "../lib/plano";
import { brl0 } from "../lib/formato";
import { formatCurrency } from "@/shared/lib/utils";
import { COR } from "./ui";

export function PainelMissao({ b, c, diasTrabalho }: { b: BaseLucro; c: Cronograma; diasTrabalho: number }) {
  const un = nomeUnidade(b.produto_nome);
  const un1 = nomeUnidade(b.produto_nome, 1);
  const produzir = Math.max(0, c.totalUnid - b.estoque);
  const tiles = [
    { k: "Faturar por dia", v: brl0(c.faturamentoTotal / Math.max(1, diasTrabalho)), sub: `${Math.round(c.totalUnid / Math.max(1, diasTrabalho))} ${un} × ${formatCurrency(b.ticket)}`, cor: COR.texto },
    { k: "Faturamento total", v: brl0(c.faturamentoTotal), sub: `${c.totalUnid} ${un} na missão`, cor: COR.texto },
    { k: "Mercadoria", v: brl0(c.mercadoriaTotal), sub: `${formatCurrency(b.custo_receita)} por ${un1} · ${brl0(c.mercadoriaTotal / Math.max(1, diasTrabalho))}/dia`, cor: COR.vermelho },
    { k: "Reserva pra calote", v: brl0(c.caloteReserva), sub: `${formatCurrency(b.calote_unid)} por ${un1} · ${brl0(b.calote.por_dia)}/dia hoje`, cor: COR.vermelho },
  ];
  return (
    <section className="mt-3">
      <p className="orbis-section px-0.5 mb-2 inline-flex items-center gap-2" style={{ color: COR.ouro }}><span className="w-4 h-px" style={{ background: COR.ouro }} /> A conta da missão</p>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t, i) => (
          <div key={t.k} className="vant-sobe rounded-[16px] px-3.5 py-3 min-w-0 relative overflow-hidden" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}`, animationDelay: `${i * 70}ms` }}>
            <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full" style={{ background: t.cor === COR.vermelho ? COR.vermelho : COR.ouro, opacity: .8 }} />
            <p className="text-[10.5px] font-bold uppercase tracking-[.08em]" style={{ color: COR.mute }}>{t.k}</p>
            <p className="vant-missao-num text-[26px] leading-none mt-1.5 truncate" style={{ color: t.cor }}>{t.v}</p>
            <p className="text-[11px] mt-1 leading-snug" style={{ color: COR.sub }}>{t.sub}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-[16px] px-4 py-3.5 flex items-center justify-between gap-3" style={{ background: "linear-gradient(90deg,rgba(245,184,0,.12),#0b0b0d 70%)", border: "1px solid rgba(245,184,0,.35)" }}>
        <span className="min-w-0">
          <span className="block orbis-section" style={{ color: COR.ouro }}>Produzir antes de começar</span>
          <span className="block text-[12px] mt-0.5" style={{ color: COR.sub }}>{b.estoque} prontas de {c.totalUnid} · insumos ~{brl0(produzir * b.custo_receita)}</span>
        </span>
        <span className="vant-missao-num text-[40px] leading-none shrink-0" style={{ color: COR.ouro }}>{produzir}</span>
      </div>
      <p className="text-[11px] mt-2 px-0.5 leading-snug" style={{ color: COR.mute }}>
        Lucro = faturamento − mercadoria − calote. Fechando os {c.totalUnid} {un} nesse ritmo você sai com {brl0(c.lucroTotal)} limpos.
      </p>
    </section>
  );
}
