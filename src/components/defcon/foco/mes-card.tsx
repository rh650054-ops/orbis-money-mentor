/* SEU MÊS — a pergunta que o Rick faz todo dia: "com o que eu tô fazendo por dia,
   eu bato a meta do mês?". Vendido × meta, o que falta por dia, e a projeção no
   ritmo real dele (o que ele faz num dia desse). Fica logo abaixo do DEFCON,
   separado, pra não embolar com a meta de hoje. Sem selo de status: a frase da
   projeção já dá o veredito (um selo "mas dá" ao lado de "faltam R$ X" confunde).
   Puro: recebe tudo por props. */
import { ChevronRight } from "lucide-react";
import type { MetaDoDia } from "@/shared/lib/meta-viavel";
import { brlOculto, PRESS } from "./foco-tipos";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const TOM: Record<MetaDoDia["status"], string> = {
  aprendendo: "#b9b3a6", folga: "#3DD68C", no_ritmo: "#3DD68C", apertado: "#F5B800", inviavel: "#F2465A",
};

/** Projeção do mês no ritmo real: vendido + (ritmo × dias de trabalho que faltam). */
export function projecaoDoMes(m: Pick<MetaDoDia, "vendidoMes" | "metaMensal" | "ritmo" | "diasRestantes">) {
  const fecha = m.vendidoMes + m.ritmo * Math.max(0, m.diasRestantes);
  const diferenca = fecha - m.metaMensal;
  return { fecha, diferenca, bate: diferenca >= 0 };
}

export function MesCard({ m, oculto, onReplanejar }: { m: MetaDoDia; oculto: boolean; onReplanejar: () => void }) {
  if (!(m.metaMensal > 0)) return null;
  const v = (n: number) => brlOculto(n, oculto);
  const cor = TOM[m.status];
  const pede = m.status === "inviavel" || m.status === "apertado";
  const mes = MESES[Number(m.hoje.slice(5, 7)) - 1] ?? "";
  const pct = Math.min(100, (m.vendidoMes / m.metaMensal) * 100);
  const proj = projecaoDoMes(m);
  const corProj = proj.bate ? "var(--orbis-ok)" : m.status === "inviavel" ? "#F2465A" : "var(--orbis-gold)";

  return (
    <section className="rounded-[20px] border mt-3 px-4 py-3.5" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }} aria-label="Seu mês">
      <p className="orbis-mini">Seu mês · {mes}</p>
      <p className="orbis-num text-[26px] font-extrabold leading-none mt-2 tracking-[-.5px]">
        {v(m.vendidoMes)}<span className="text-[13px] font-bold tracking-normal ml-1.5" style={{ color: "var(--orbis-fg-3)" }}>de {v(m.metaMensal)}</span>
      </p>
      <div className="h-1.5 rounded-full mt-2.5 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: cor }} />
      </div>

      {m.status === "aprendendo" ? (
        <p className="text-[12.5px] mt-3" style={{ color: "var(--orbis-fg-2)" }}>A Vant ainda está aprendendo seu ritmo — a projeção aparece depois do primeiro dia vendido.</p>
      ) : m.faltaMes <= 0 ? (
        <p className="text-[12.5px] mt-3" style={{ color: "var(--orbis-fg-2)" }}>Meta do mês <b style={{ color: "var(--orbis-ok)" }}>batida</b>. Agora é só somar.</p>
      ) : (
        <>
          <p className="text-[12.5px] mt-3" style={{ color: "var(--orbis-fg-2)" }}>
            Faltam <b className="text-foreground">{v(m.faltaMes)}</b> em <b className="text-foreground">{m.diasRestantes} dia{m.diasRestantes === 1 ? "" : "s"}</b> → precisa de <b className="text-foreground">{v(m.precisaDia)}</b> por dia
          </p>
          <p className="text-[12.5px] mt-1.5 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
            No seu ritmo de <b className="text-foreground">{v(m.ritmo)}/dia</b> você fecha em <b style={{ color: corProj }}>{v(proj.fecha)}</b>
            {proj.bate
              ? <> — <b style={{ color: corProj }}>bate a meta</b>{proj.diferenca > 0 ? <> com {v(proj.diferenca)} de folga</> : null}</>
              : <> — <b style={{ color: corProj }}>faltam {v(-proj.diferenca)}</b> pra bater</>}
          </p>
          {pede && (
            <button type="button" onClick={onReplanejar} className={`mt-3 inline-flex items-center gap-1 h-9 px-3.5 rounded-full text-[12.5px] font-extrabold ${PRESS}`} style={{ border: `1px solid ${cor}66`, color: cor, background: `${cor}14` }}>
              Replanejar o mês <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} />
            </button>
          )}
        </>
      )}
    </section>
  );
}
