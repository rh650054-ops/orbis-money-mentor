/* SEU MÊS — responde em uma olhada: "com o que eu faço por dia, bato a meta do mês?".
   Três números (precisa / você faz / fecha em) e UMA frase de veredito. Nada de texto
   corrido (Rick, 18/10). Puro: recebe tudo por props. */
import { ChevronRight } from "lucide-react";
import type { MetaDoDia } from "@/shared/lib/meta-viavel";
import type { SobrarMes } from "@/features/objetivo-lucro";
import type { TipoReplanejar } from "@/components/metas/ReplanejarMes";
import { brl0, brlK, PRESS } from "./foco-tipos";
import { DicasMes, SobrarLinha } from "./mes-sobrar";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Projeção do mês no ritmo real: vendido + (ritmo × dias de trabalho que faltam). */
export function projecaoDoMes(m: Pick<MetaDoDia, "vendidoMes" | "metaMensal" | "ritmo" | "diasRestantes">) {
  const fecha = m.vendidoMes + m.ritmo * Math.max(0, m.diasRestantes);
  const diferenca = fecha - m.metaMensal;
  return { fecha, diferenca, bate: diferenca >= 0 };
}

export function MesCard({ m, onReplanejar, sobrar, onDefinirLucro, onProduto }: {
  m: MetaDoDia; onReplanejar: (tipo?: TipoReplanejar) => void;
  /** 29/10: SOBRAR · no bolso under the VENDER block (null while loading / not Pro) */
  sobrar?: SobrarMes | null; onDefinirLucro?: () => void; onProduto?: () => void;
}) {
  if (!(m.metaMensal > 0)) return null;
  const pede = m.status === "inviavel" || m.status === "apertado";
  const mes = MESES[Number(m.hoje.slice(5, 7)) - 1] ?? "";
  const pct = Math.min(100, (m.vendidoMes / m.metaMensal) * 100);
  const proj = projecaoDoMes(m);
  const batido = m.faltaMes <= 0;
  const cor = batido || proj.bate ? "var(--orbis-ok)" : m.status === "inviavel" ? "#F2465A" : "var(--orbis-gold)";
  const kpi = (k: string, v: string, c?: string) => (
    <div className="rounded-[12px] px-2 py-1.5 min-w-0" style={{ background: "rgba(0,0,0,.35)", border: "1px solid var(--orbis-line)" }}>
      <p className="text-[9px] font-bold uppercase tracking-[.04em] whitespace-nowrap" style={{ color: "var(--orbis-fg-3)" }}>{k}</p>
      <p className="orbis-num text-[13px] font-extrabold mt-0.5 whitespace-nowrap" style={c ? { color: c } : undefined}>{v}</p>
    </div>
  );

  return (
    <section className="rounded-[20px] border mt-3 px-4 py-3.5" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }} aria-label="Seu mês">
      <div className="flex items-center justify-between gap-2">
        <p className="orbis-mini">Vender · {mes}</p>
        <span className="orbis-num text-[12px] font-bold" style={{ color: "var(--orbis-fg-3)" }}>{Math.round(pct)}%</span>
      </div>
      <p className="orbis-num text-[22px] font-extrabold leading-none mt-2 tracking-[-.5px]">
        {brl0(m.vendidoMes)}<span className="text-[13px] font-bold tracking-normal ml-1.5" style={{ color: "var(--orbis-fg-3)" }}>de {brl0(m.metaMensal)}</span>
      </p>
      <div className="h-1.5 rounded-full mt-2.5 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: cor }} />
      </div>

      {m.status === "aprendendo" ? (
        <p className="text-[12.5px] mt-3" style={{ color: "var(--orbis-fg-2)" }}>A projeção aparece depois do seu primeiro dia vendido.</p>
      ) : batido ? (
        <p className="text-[13px] font-bold mt-3" style={{ color: cor }}>Meta do mês batida.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            {kpi("Precisa/dia", brlK(m.precisaDia))}
            {kpi("Faz/dia", brlK(m.ritmo))}
            {kpi("Fecha em", brlK(proj.fecha), cor)}
          </div>
          <div className="flex items-center justify-between gap-2 mt-3">
            <p className="text-[12px] font-bold min-w-0" style={{ color: cor }}>
              {proj.bate ? `Bate a meta${proj.diferenca > 0 ? ` · ${brl0(proj.diferenca)} de folga` : ""}` : `Faltam ${brl0(-proj.diferenca)} pra bater`}
            </p>
            {pede && (
              <button type="button" onClick={() => onReplanejar()} className={`inline-flex items-center gap-0.5 h-8 px-3 rounded-full text-[12px] font-extrabold shrink-0 ${PRESS}`} style={{ border: `1px solid ${cor}66`, color: cor, background: `${cor}14` }}>
                Replanejar <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
              </button>
            )}
          </div>
          {pede && <DicasMes m={m} onDica={onReplanejar} />}
        </>
      )}
      {sobrar && onDefinirLucro && onProduto && (
        <SobrarLinha s={sobrar} fecha={batido ? m.vendidoMes : proj.fecha} bate={batido || proj.bate} onDefinirLucro={onDefinirLucro} onProduto={onProduto} />
      )}
    </section>
  );
}
