/* ============================================================
   META DO DIA no Foco (Rick, 11/10/2026)
   O número grande é a meta de HOJE, calculada do sonho do mês e do ritmo real
   dele (shared/lib/meta-viavel). Embaixo: o ritmo desse dia da semana, as três
   faixas e a linha do mês com o status. Quando o mês sai do ritmo, o botão
   abre o replanejamento. Puro: recebe tudo por props.
   ============================================================ */
import { ChevronRight, Sparkles } from "lucide-react";
import { DIAS_PT, textoStatus, type MetaDoDia } from "@/shared/lib/meta-viavel";
import { FaixasDaMeta } from "./FaixasDaMeta";

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const TOM: Record<MetaDoDia["status"], { cor: string; fundo: string }> = {
  aprendendo: { cor: "#b9b3a6", fundo: "rgba(255,255,255,.06)" },
  folga: { cor: "#3DD68C", fundo: "rgba(61,214,140,.12)" },
  no_ritmo: { cor: "#3DD68C", fundo: "rgba(61,214,140,.12)" },
  apertado: { cor: "#F5B800", fundo: "rgba(245,184,0,.12)" },
  inviavel: { cor: "#F2465A", fundo: "rgba(242,70,90,.14)" },
};

export function MetaDoDiaCard({ m, vendidoHoje, blocos, onReplanejar }: { m: MetaDoDia; vendidoHoje: number; blocos: number; onReplanejar: () => void }) {
  const dia = DIAS_PT[m.diaSemana] ?? "hoje";
  const mes = MESES[Number(m.hoje.slice(5, 7)) - 1] ?? "";
  const tom = TOM[m.status];
  const pedeReplanejar = m.status === "inviavel" || m.status === "apertado";
  return (
    <>
      <p className="orbis-mini mt-3.5">Meta de {dia}</p>
      <p className="orbis-num text-[40px] font-extrabold leading-none mt-1.5 tracking-[-1px]">{brl0(m.meta)}</p>
      <p className="text-[12.5px] mt-2" style={{ color: "var(--orbis-fg-2)" }}>
        {m.status === "aprendendo"
          ? <><Sparkles className="inline w-3 h-3 -mt-0.5" style={{ color: "var(--orbis-gold)" }} /> a Vant ainda está aprendendo seu ritmo · a meta vai se ajustar a cada dia vendido</>
          : <>seu {dia} normal é <b className="text-foreground">{brl0(m.ritmo)}</b>{m.amostraDia > 0 ? <> · {m.amostraDia} {dia}{m.amostraDia > 1 ? "s" : ""}</> : null} · <b className="text-foreground">{blocos} blocos</b> de 1h</>}
      </p>

      <div className="mt-4"><FaixasDaMeta m={m} vendido={vendidoHoje} /></div>

      {/* o mês: sonho × realidade */}
      <button type="button" onClick={pedeReplanejar ? onReplanejar : undefined}
        className="w-full mt-4 rounded-[16px] px-3.5 py-3 text-left"
        style={{ border: `1px solid ${pedeReplanejar ? tom.cor + "55" : "rgba(255,255,255,.09)"}`, background: "rgba(255,255,255,.035)", cursor: pedeReplanejar ? "pointer" : "default" }}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-extrabold uppercase tracking-[.14em]" style={{ color: "var(--orbis-fg-3)" }}>{mes}</p>
          <span className="rounded-full px-2 py-[3px] text-[9.5px] font-black tracking-[.04em]" style={{ color: tom.cor, background: tom.fundo }}>{textoStatus(m)}</span>
        </div>
        <div className="flex items-end justify-between gap-2 mt-1.5">
          <p className="orbis-num text-[17px] font-extrabold leading-none"><span className="text-foreground">{brl0(m.vendidoMes)}</span><span className="text-[12px] font-bold" style={{ color: "var(--orbis-fg-3)" }}> de {brl0(m.metaMensal)}</span></p>
          {pedeReplanejar && <span className="inline-flex items-center gap-0.5 text-[11.5px] font-extrabold" style={{ color: tom.cor }}>replanejar <ChevronRight className="w-3.5 h-3.5" strokeWidth={3} /></span>}
        </div>
        <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (m.vendidoMes / Math.max(1, m.metaMensal)) * 100)}%`, background: tom.cor }} />
        </div>
        <p className="text-[11.5px] mt-2 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
          {m.faltaMes <= 0
            ? <>Sonho do mês <b style={{ color: "#3DD68C" }}>batido</b>. Agora é só somar.</>
            : <>faltam <b className="text-foreground">{brl0(m.faltaMes)}</b> em <b className="text-foreground">{m.diasRestantes} dia{m.diasRestantes === 1 ? "" : "s"}</b> de trabalho · <b style={{ color: tom.cor }}>{brl0(m.precisaDia)}/dia</b>{m.status === "inviavel" ? <> — hoje você faz uns {brl0(m.ritmo)}</> : null}</>}
        </p>
      </button>
    </>
  );
}
