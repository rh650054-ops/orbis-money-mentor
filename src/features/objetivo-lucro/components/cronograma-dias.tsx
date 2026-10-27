/* The day-by-day schedule: a grid of the mission's days. Work days show units and
   revenue; off days are dim. Strong weekdays carry a gold mark. */
import { Minus, Plus } from "lucide-react";
import type { Cronograma } from "../lib/cronograma";
import { nomeUnidade } from "../lib/plano";
import { brl0 } from "../lib/formato";
import { Passo } from "./passo-meta";
import { COR } from "./ui";

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

interface Props {
  c: Cronograma;
  produto: string | null;
  dias: number;
  diasTrabalho: number;
  sugestaoIa: number | null;
  onDiasTrabalho: (n: number) => void;
}

export function CronogramaDias({ c, produto, dias, diasTrabalho, sugestaoIa, onDiasTrabalho }: Props) {
  const un = nomeUnidade(produto);
  const cols = c.dias.length <= 7 ? c.dias.length : 5;
  return (
    <section className="vant-hud mt-3 rounded-[22px] px-4 pt-4 pb-4 overflow-hidden" style={{ border: "1px solid rgba(245,184,0,.3)" }}>
      <span className="vant-canto" />
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <p className="orbis-section inline-flex items-center gap-2" style={{ color: COR.ouro }}><span className="w-4 h-px" style={{ background: COR.ouro }} /> Cronograma</p>
          <p className="text-[11.5px] mt-1" style={{ color: COR.sub }}>
            {diasTrabalho} dias de trabalho{sugestaoIa && sugestaoIa !== diasTrabalho ? ` · Vant sugere ${sugestaoIa}` : ""}
          </p>
        </span>
        <span className="inline-flex items-center gap-1 shrink-0">
          <Passo onClick={() => onDiasTrabalho(Math.max(1, diasTrabalho - 1))} label="Menos um dia de trabalho"><Minus className="w-4 h-4" /></Passo>
          <span className="vant-missao-num w-[70px] text-center text-[28px] leading-none whitespace-nowrap" style={{ color: COR.ouro }}>{diasTrabalho}<span className="text-[16px]" style={{ color: COR.mute }}>/{dias}</span></span>
          <Passo onClick={() => onDiasTrabalho(Math.min(dias, diasTrabalho + 1))} label="Mais um dia de trabalho"><Plus className="w-4 h-4" /></Passo>
        </span>
      </div>

      <div className="mt-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {c.dias.map((d, i) => {
          const dd = d.data.slice(8, 10);
          return (
            <div key={d.data} className="vant-sobe rounded-[12px] px-1 pt-1.5 pb-1.5 text-center relative overflow-hidden" style={{ animationDelay: `${i * 30}ms`,
              background: d.trabalha ? "rgba(245,184,0,.09)" : "rgba(255,255,255,.03)",
              border: `1px solid ${d.trabalha ? "rgba(245,184,0,.45)" : "rgba(255,255,255,.07)"}` }}>
              {d.forte && d.trabalha && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: COR.ouro, boxShadow: `0 0 6px ${COR.ouro}` }} />}
              <p className="text-[9.5px] font-black uppercase tracking-[.06em]" style={{ color: d.trabalha ? COR.sub : COR.mute }}>{DOW[d.dow]} {dd}</p>
              {d.trabalha ? (
                <>
                  <p className="vant-missao-num text-[26px] leading-none mt-1" style={{ color: COR.ouro }}>{d.unid}</p>
                  <p className="orbis-num text-[9.5px] font-bold mt-0.5 truncate" style={{ color: COR.sub }}>{brl0(d.faturamento)}</p>
                </>
              ) : (
                <p className="text-[10px] font-bold mt-2.5 mb-1" style={{ color: COR.mute }}>folga</p>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] mt-3 leading-snug" style={{ color: COR.mute }}>
        Número = {un} a vender no dia; embaixo, o faturamento. Ponto dourado = dia que costuma ser forte pra você. Entre {c.menorDia} e {c.maiorDia} por dia.
      </p>
    </section>
  );
}
