/* The AI's verdict: title in the Vant's voice, the big "X per day", the rhythm scale
   and the 2–3 sentence read of his bank, sales and calotes. */
import { Sparkles } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import type { BaseLucro, PlanoIa } from "../types";
import { nomeUnidade, type Nivel, type PlanoLucro } from "../lib/plano";
import { EscalaRitmo } from "./escala-ritmo";
import { COR } from "./ui";

const NIVEL: Record<Nivel, { cor: string; fundo: string; titulo: string }> = {
  tranquilo: { cor: COR.verde, fundo: "rgba(61,214,140,.18)", titulo: "Dá com seu ritmo" },
  puxado: { cor: COR.ouro, fundo: "rgba(245,184,0,.18)", titulo: "Puxado, mas você já fez isso" },
  acima: { cor: COR.vermelho, fundo: "rgba(229,115,127,.18)", titulo: "Acima do seu recorde" },
  "sem-historico": { cor: COR.sub, fundo: "rgba(255,255,255,.08)", titulo: "Sua meta por dia" },
};

interface Props {
  b: BaseLucro;
  p: PlanoLucro;
  ia: PlanoIa | null;
  /** units/day currently shown (AI's, or recalculated after changing work days) */
  unidDia: number | null;
  diasTrabalho: number;
}

export function VereditoHero({ b, p, ia, unidDia, diasTrabalho }: Props) {
  const nivel: Nivel = ia?.veredito && p.nivel !== "sem-historico" ? ia.veredito : p.nivel;
  const n = NIVEL[nivel];
  const un = nomeUnidade(b.produto_nome);
  return (
    <section className="mt-4 rounded-[24px] p-5 relative overflow-hidden"
      style={{ background: `radial-gradient(130% 80% at 15% 0%, ${n.fundo}, #0e0e10 60%)`, border: `1px solid ${n.cor}55`, boxShadow: `0 20px 60px -30px ${n.cor}66` }}>
      <p className="orbis-section inline-flex items-center gap-1.5" style={{ color: n.cor }}>
        <Sparkles className="w-3.5 h-3.5" /> {ia ? "Veredito da Vant" : "Pela sua média"}
      </p>
      <h4 className="text-[22px] font-black tracking-tight leading-[1.1] mt-1.5 text-foreground">{ia?.titulo || n.titulo}</h4>

      <div className="mt-4 flex items-end gap-2">
        <span className="orbis-num text-[56px] font-black leading-[.9] tracking-tighter" style={{ color: n.cor }}>{unidDia ?? "—"}</span>
        <span className="pb-1">
          <span className="block text-[15px] font-extrabold" style={{ color: COR.texto }}>{un} por dia</span>
          <span className="block text-[12px]" style={{ color: COR.sub }}>em {diasTrabalho} dias de trabalho · {formatCurrency(p.precisaDia)} de lucro/dia</span>
        </span>
      </div>

      {p.nivel !== "sem-historico" && unidDia !== null && (
        <EscalaRitmo media={b.unid_dia} meta={unidDia} recorde={b.recorde_dia} cor={n.cor} unidade={un} />
      )}

      {ia?.resumo && (
        <p className="text-[13.5px] leading-[1.5] mt-4 pt-4" style={{ color: COR.texto, borderTop: "1px solid rgba(255,255,255,.08)" }}>{ia.resumo}</p>
      )}
      {!ia && p.nivel !== "sem-historico" && (
        <p className="text-[13px] leading-[1.5] mt-4 pt-4" style={{ color: COR.sub, borderTop: "1px solid rgba(255,255,255,.08)" }}>
          Na sua média você lucra {formatCurrency(p.projecao)} nesses dias{p.faltaNaMedia > 0 ? ` — faltam ${formatCurrency(p.faltaNaMedia)}` : ", já bate"}. Sua média é {b.unid_dia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} {un}/dia, recorde {b.recorde_dia}.
        </p>
      )}
    </section>
  );
}
