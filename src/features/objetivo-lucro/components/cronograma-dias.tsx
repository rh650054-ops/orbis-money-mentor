/* The day-by-day schedule. Each work day: batidas to bring and sell, how many sales
   that is (combos), revenue and the day's real profit. A stock bar under each day
   shows when the ready stock runs out, and the banner says by when to produce. */
import { Minus, Plus, Package } from "lucide-react";
import type { BaseLucro } from "../types";
import type { Cronograma } from "../lib/cronograma";
import { nomeUnidade } from "../lib/plano";
import { brl0 } from "../lib/formato";
import { Passo } from "./passo-meta";
import { COR } from "./ui";

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

interface Props {
  b: BaseLucro;
  c: Cronograma;
  dias: number;
  diasTrabalho: number;
  sugestaoIa: number | null;
  onDiasTrabalho: (n: number) => void;
}

export function CronogramaDias({ b, c, dias, diasTrabalho, sugestaoIa, onDiasTrabalho }: Props) {
  const un = nomeUnidade(b.produto_nome);
  const cols = c.dias.length <= 4 ? c.dias.length : 3;
  const produzir = Math.max(0, c.totalUnid - b.estoque);
  return (
    <section className="vant-hud mt-3 rounded-[22px] px-4 pt-4 pb-4 overflow-hidden" style={{ border: "1px solid rgba(245,184,0,.3)" }}>
      <span className="vant-canto" />
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <p className="orbis-section inline-flex items-center gap-2" style={{ color: COR.ouro }}><span className="w-4 h-px" style={{ background: COR.ouro }} /> Cronograma</p>
          <p className="text-[11.5px] mt-1" style={{ color: COR.sub }}>
            dias de trabalho{sugestaoIa && sugestaoIa !== diasTrabalho ? ` · Vant sugere ${sugestaoIa}` : ""}
          </p>
        </span>
        <span className="inline-flex items-center gap-1 shrink-0">
          <Passo onClick={() => onDiasTrabalho(Math.max(1, diasTrabalho - 1))} label="Menos um dia de trabalho"><Minus className="w-4 h-4" /></Passo>
          <span className="vant-missao-num w-[70px] text-center text-[28px] leading-none whitespace-nowrap" style={{ color: COR.ouro }}>{diasTrabalho}<span className="text-[16px]" style={{ color: COR.mute }}>/{dias}</span></span>
          <Passo onClick={() => onDiasTrabalho(Math.min(dias, diasTrabalho + 1))} label="Mais um dia de trabalho"><Plus className="w-4 h-4" /></Passo>
        </span>
      </div>

      <div className="mt-3 rounded-[14px] px-3.5 py-2.5 flex items-center gap-3" style={{ background: produzir > 0 ? "rgba(229,115,127,.08)" : "rgba(61,214,140,.08)", border: `1px solid ${produzir > 0 ? "rgba(229,115,127,.35)" : "rgba(61,214,140,.35)"}` }}>
        <Package className="w-4 h-4 shrink-0" style={{ color: produzir > 0 ? COR.vermelho : COR.verde }} />
        <p className="text-[12px] leading-snug" style={{ color: COR.texto }}>
          {produzir > 0
            ? <>Seu estoque de <b>{b.estoque}</b> {c.estoqueAte ? <>cobre até <b>{dm(c.estoqueAte)}</b></> : "não cobre o 1º dia"}. Produza <b style={{ color: COR.ouro }}>{produzir} {un}</b>{c.produzirAte ? <> antes de <b>{dm(c.produzirAte)}</b></> : null}.</>
            : <>Seu estoque de <b>{b.estoque}</b> cobre a missão inteira.</>}
        </p>
      </div>

      <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {c.dias.map((d, i) => {
          const semEstoque = d.trabalha && d.estoqueFim < 0;
          return (
            <div key={d.data} className="vant-sobe rounded-[14px] px-2.5 pt-2 pb-2 relative overflow-hidden" style={{ animationDelay: `${i * 30}ms`,
              background: d.trabalha ? "rgba(245,184,0,.08)" : "rgba(255,255,255,.025)",
              border: `1px solid ${d.trabalha ? "rgba(245,184,0,.4)" : "rgba(255,255,255,.07)"}` }}>
              <p className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.06em]" style={{ color: d.trabalha ? COR.sub : COR.mute }}>
                <span>{DOW[d.dow]} {d.data.slice(8, 10)}</span>
                {d.forte && d.trabalha && <span className="w-1.5 h-1.5 rounded-full" style={{ background: COR.ouro, boxShadow: `0 0 6px ${COR.ouro}` }} />}
              </p>
              {d.trabalha ? (
                <>
                  <p className="mt-1 flex items-baseline gap-1">
                    <span className="vant-missao-num text-[32px] leading-none" style={{ color: COR.ouro }}>{d.unid}</span>
                    <span className="text-[10px] font-bold" style={{ color: COR.sub }}>{un}</span>
                  </p>
                  <p className="text-[10.5px] font-bold" style={{ color: COR.sub }}>≈ {d.atendimentos} vendas</p>
                  <p className="orbis-num text-[11px] font-bold mt-1" style={{ color: COR.texto }}>{brl0(d.faturamento)}</p>
                  <p className="orbis-num text-[11px] font-black" style={{ color: COR.verde }}>+{brl0(d.lucro)} lucro</p>
                  <span className="absolute left-0 right-0 bottom-0 h-[3px]" style={{ background: semEstoque ? COR.vermelho : COR.verde, opacity: .8 }} />
                </>
              ) : (
                <p className="text-[11px] font-bold mt-4 mb-4 text-center" style={{ color: COR.mute }}>folga</p>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] mt-3 leading-snug" style={{ color: COR.mute }}>
        Vendas ≈ {un} ÷ {b.combos.unid_por_venda.toLocaleString("pt-BR")} (você vende {b.combos.um}% de 1, {b.combos.dois}% combo de 2{b.combos.tres > 0 ? `, ${b.combos.tres}% de 3+` : ""}). Lucro já tira mercadoria e calote. Faixa embaixo: verde = estoque pronto, vermelha = precisa produzir.
      </p>
    </section>
  );
}
