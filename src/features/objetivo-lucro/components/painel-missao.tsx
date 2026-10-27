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
  const d = Math.max(1, diasTrabalho);
  const linhas = [
    { k: "Faturar", v: c.faturamentoTotal / d, sub: `${Math.round(c.totalUnid / d)} ${un} × ${formatCurrency(b.ticket)} (média com combos)`, cor: COR.texto, sinal: "" },
    { k: "Mercadoria", v: c.mercadoriaTotal / d, sub: `${formatCurrency(b.custo_receita)} por ${un1}`, cor: COR.vermelho, sinal: "−" },
    { k: "Reserva pra calote", v: c.caloteReserva / d, sub: `${formatCurrency(b.calote_unid)} por ${un1} · hoje você perde ${brl0(b.calote.por_dia)}/dia`, cor: COR.vermelho, sinal: "−" },
  ];
  return (
    <section className="mt-3">
      <p className="orbis-section px-0.5 mb-2 inline-flex items-center gap-2" style={{ color: COR.ouro }}><span className="w-4 h-px" style={{ background: COR.ouro }} /> A conta da missão</p>
      <div className="rounded-[18px] overflow-hidden" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}` }}>
        <p className="orbis-section px-4 pt-3" style={{ color: COR.mute }}>Por dia de trabalho</p>
        {linhas.map((l, i) => (
          <div key={l.k} className="vant-sobe px-4 py-2.5 flex items-center justify-between gap-3" style={{ borderTop: i ? "1px solid rgba(255,255,255,.06)" : undefined, animationDelay: `${i * 70}ms` }}>
            <span className="min-w-0">
              <span className="block text-[13px] font-extrabold" style={{ color: COR.texto }}>{l.k}</span>
              <span className="block text-[11px]" style={{ color: COR.sub }}>{l.sub}</span>
            </span>
            <span className="vant-missao-num text-[26px] leading-none shrink-0" style={{ color: l.cor }}>{l.sinal}{brl0(l.v)}</span>
          </div>
        ))}
        <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ background: "rgba(61,214,140,.08)", borderTop: "1px solid rgba(61,214,140,.3)" }}>
          <span className="text-[13px] font-black" style={{ color: COR.verde }}>= Lucro do dia</span>
          <span className="vant-missao-num text-[34px] leading-none" style={{ color: COR.verde }}>{brl0(c.lucroTotal / d)}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[["Faturamento", brl0(c.faturamentoTotal), COR.texto], ["Mercadoria", brl0(c.mercadoriaTotal), COR.vermelho], ["Calote", brl0(c.caloteReserva), COR.vermelho]].map(([k, v, cor]) => (
          <div key={k} className="rounded-[14px] px-2.5 py-2.5 min-w-0" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}` }}>
            <p className="text-[10px] font-bold uppercase tracking-[.06em]" style={{ color: COR.mute }}>{k}</p>
            <p className="vant-missao-num text-[19px] leading-none mt-1 whitespace-nowrap" style={{ color: cor }}>{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-[16px] px-4 py-3.5 flex items-center justify-between gap-3" style={{ background: "linear-gradient(90deg,rgba(245,184,0,.12),#0b0b0d 70%)", border: "1px solid rgba(245,184,0,.35)" }}>
        <span className="min-w-0">
          <span className="block orbis-section" style={{ color: COR.ouro }}>Produzir pra missão</span>
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
