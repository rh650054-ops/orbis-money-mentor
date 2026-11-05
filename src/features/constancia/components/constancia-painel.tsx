/* The Constância panel (Rick, 05/11): tap the flame at the top → like Duolingo's "Ofensiva".
   Big number with the flame, what state it is in (frozen / lost / rescue) and what to do,
   the month calendar with arrows, the "meta de constância" bar to the next milestone, the record. */
import { useState } from "react";
import { Gaveta } from "@/shared/components/gaveta";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { useConstanciaQuery } from "../api/use-constancia";
import { marcoAnterior, nomeDoMarco, proximoMarco } from "../lib/marcos";
import type { Constancia } from "../types";
import { CalendarioMes } from "./calendario-mes";
import { ChamaIcone, lookDoEstado } from "./chama-icone";

const OURO = "#F5B800";
const SUB = "#b9b3a6";

/** The banner under the number: what state the flame is in and what gets it back. */
export function textoDoEstado(c: Constancia): { titulo: string; texto: string; cor: string } | null {
  if (c.estado === "congelada") return { titulo: "Sua chama congelou", cor: "#9FD6F5",
    texto: c.hoje_trabalhou ? "Você vendeu hoje: ela descongela no fim do dia." : `Você não trabalhou ${c.faltas === 1 ? "um dia" : `${c.faltas} dias`} de trabalho. Pra descongelar, vende hoje.` };
  if (c.estado === "perdeu") return { titulo: "Sua chama apagou", cor: "#e5737f",
    texto: `3 dias de trabalho sem vender. Você tinha ${c.guardados} dias: venda 7 dias de trabalho seguidos e eles voltam, com mais 7.` };
  if (c.estado === "resgate") return { titulo: `Resgate: ${c.resgate} de 7 dias`, cor: OURO,
    texto: `Faltam ${7 - c.resgate}. Complete e sua chama volta com ${c.guardados + 7} dias. Faltou 1 dia de trabalho, perde tudo.` };
  if (c.estado === "acesa" && c.hoje_trabalha && !c.hoje_trabalhou && c.dias > 0) return { titulo: "Hoje é dia de trabalho", cor: OURO,
    texto: "Abra o Foco e sua chama cresce mais um dia." };
  return null;
}

export function ConstanciaPainel({ userId, open, onOpenChange }: { userId: string | undefined; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [mes, setMes] = useState(() => getBrazilDate().slice(0, 7) + "-01");
  const { data: c } = useConstanciaQuery(open ? userId : undefined, mes);
  const dias = c?.dias ?? 0;
  const estado = c?.estado ?? "nunca";
  const look = lookDoEstado(estado, dias);
  const numero = estado === "resgate" && c ? c.guardados + c.resgate : dias;
  const aviso = c ? textoDoEstado(c) : null;
  const base = estado === "resgate" && c ? c.guardados + c.resgate : dias;
  const marco = proximoMarco(base);
  const de = marcoAnterior(base);
  const pct = marco > de ? Math.min(100, Math.max(0, ((base - de) / (marco - de)) * 100)) : 100;
  const corNum = look === "gelo" ? "#DFF4FF" : look === "apagada" ? "#57534A" : "#F9CE63";
  return (
    <Gaveta open={open} onOpenChange={onOpenChange} titulo="Constância" style={{ background: "#0e0e10", borderColor: "#2a2416" }}>
      <div className="px-[18px] pt-1 space-y-5" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="orbis-section" style={{ color: OURO }}>Constância</p>
            <p className="vant-missao-num leading-none mt-1" style={{ fontSize: 32, color: corNum }}>{numero} <span className="text-[14px] font-bold" style={{ color: SUB }}>{numero === 1 ? "dia" : "dias"}</span></p>
            <p className="text-[12px] mt-1" style={{ color: SUB }}>{estado === "nunca" ? "Abra o Foco e acenda a sua chama." : `Recorde: ${c?.recorde ?? 0} dias`}</p>
          </div>
          <ChamaIcone size={64} look={look} />
        </div>

        {aviso && (
          <div className="rounded-[16px] px-4 py-3" style={{ border: `1px solid ${aviso.cor}55`, background: `${aviso.cor}14` }}>
            <p className="text-[11px] font-black tracking-[.1em] uppercase" style={{ color: aviso.cor }}>{aviso.titulo}</p>
            <p className="text-[13px] leading-snug mt-1 text-foreground">{aviso.texto}</p>
          </div>
        )}

        <CalendarioMes mes={mes} dias={c?.mes ?? []} onMes={setMes} />

        <section aria-label="Meta de constância">
          <p className="text-[16px] font-black text-foreground">Meta de constância</p>
          <div className="mt-2 rounded-[18px] px-4 py-3" style={{ border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.038)" }}>
            <div className="flex items-center justify-between text-[12px] font-bold" style={{ color: SUB }}>
              <span>{de} dias</span><span style={{ color: OURO }}>{marco} dias · {nomeDoMarco(marco)}</span>
            </div>
            <div className="mt-2 h-[10px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg,#EDA45C,${OURO})` }} />
            </div>
            <p className="text-[12px] mt-2" style={{ color: SUB }}>{marco - base > 0 ? `Faltam ${marco - base} ${marco - base === 1 ? "dia" : "dias"} pro próximo marco.` : "Marco batido!"}</p>
          </div>
        </section>

        <section className="rounded-[18px] px-4 py-3 text-[12.5px] leading-relaxed" style={{ border: "1px solid rgba(255,255,255,.07)", color: SUB }}>
          <b className="text-foreground">Como funciona:</b> todo dia de trabalho que você abre o Foco, +1. Folga do planejamento não conta.
          Faltou um dia de trabalho, congela: vende e descongela. Faltou 3, apaga, mas dá pra resgatar com 7 dias seguidos.
        </section>
      </div>
    </Gaveta>
  );
}
