/* The mission briefing: target, status, the big "X per day", the rhythm scale and
   the Vant's read of his bank, sales and calotes — all in one HUD card. */
import { formatCurrency } from "@/shared/lib/utils";
import type { BaseLucro, PlanoIa } from "../types";
import { nomeUnidade, type Nivel, type PlanoLucro } from "../lib/plano";
import { brl0 } from "../lib/formato";
import { EscalaRitmo } from "./escala-ritmo";
import { COR } from "./ui";

const NIVEL: Record<Nivel, { cor: string; classe: string; status: string; titulo: string }> = {
  tranquilo: { cor: COR.verde, classe: "vant-verde", status: "No seu ritmo", titulo: "Dá com seu ritmo" },
  puxado: { cor: COR.ouro, classe: "", status: "Puxado", titulo: "Puxado, mas você já fez isso" },
  acima: { cor: COR.vermelho, classe: "vant-vermelho", status: "Acima do recorde", titulo: "Acima do seu recorde" },
  "sem-historico": { cor: COR.sub, classe: "", status: "Sem histórico", titulo: "Sua meta por dia" },
};

interface Props {
  b: BaseLucro;
  p: PlanoLucro;
  ia: PlanoIa | null;
  alvo: number;
  dias: number;
  /** units/day currently shown (AI's, or recalculated after changing work days) */
  unidDia: number | null;
  diasTrabalho: number;
}

export function VereditoHero({ b, p, ia, alvo, dias, unidDia, diasTrabalho }: Props) {
  const nivel: Nivel = ia?.veredito && p.nivel !== "sem-historico" ? ia.veredito : p.nivel;
  const n = NIVEL[nivel];
  const un = nomeUnidade(b.produto_nome);
  const fim = new Date(); fim.setDate(fim.getDate() + dias - 1);
  return (
    <section className={`vant-hud vant-sobe ${n.classe} mt-4 rounded-[24px] px-5 pt-5 pb-4 overflow-hidden`}
      style={{ border: `1px solid ${n.cor}66`, boxShadow: `0 24px 70px -34px ${n.cor}` }}>
      <span className="vant-canto" />
      <div className="flex items-center justify-between gap-2">
        <p className="orbis-section" style={{ color: COR.mute }}>Missão{b.apelido ? ` · ${b.apelido}` : ""}</p>
        <p className="orbis-num text-[10.5px] font-black uppercase tracking-[.12em] px-2 py-1 rounded-full inline-flex items-center gap-1.5"
          style={{ color: n.cor, border: `1px solid ${n.cor}66`, background: `${n.cor}14` }}>
          <span className="vant-blink w-1.5 h-1.5 rounded-full" style={{ background: n.cor }} /> {n.status}
        </p>
      </div>
      <p className="vant-missao-num vant-glow text-[52px] leading-none mt-2 whitespace-nowrap" style={{ color: COR.ouro }}>{brl0(alvo)}</p>
      <p className="orbis-section mt-1" style={{ color: COR.sub }}>de lucro · {dias} dias · até {fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>

      <h4 className="text-[19px] font-black tracking-tight leading-[1.15] mt-5 text-foreground">{ia?.titulo || n.titulo}</h4>

      <div className="mt-3 flex items-end gap-3">
        <span className="vant-missao-num text-[88px] leading-[.85] tracking-tight" style={{ color: n.cor, textShadow: `0 0 28px ${n.cor}66` }}>{unidDia ?? "—"}</span>
        <span className="pb-2 min-w-0">
          <span className="block text-[16px] font-black leading-tight" style={{ color: COR.texto }}>{un} por dia</span>
          <span className="block text-[12px] mt-0.5" style={{ color: COR.sub }}>{formatCurrency(p.precisaDia)} de lucro por dia de trabalho</span>
        </span>
      </div>

      {p.nivel !== "sem-historico" && unidDia !== null && (
        <EscalaRitmo media={b.unid_dia} meta={unidDia} recorde={b.recorde_dia} cor={n.cor} unidade={un} />
      )}

      <p className="text-[13.5px] leading-[1.55] mt-4 pt-4" style={{ color: COR.texto, borderTop: "1px solid rgba(255,255,255,.08)" }}>
        {ia?.resumo || (p.nivel !== "sem-historico"
          ? `Na sua média você lucra ${formatCurrency(p.projecao)} nesses dias${p.faltaNaMedia > 0 ? ` — faltam ${formatCurrency(p.faltaNaMedia)}` : ", já bate"}. Sua média é ${b.unid_dia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${un}/dia, recorde ${b.recorde_dia}.`
          : "Ainda não tenho vendas suas no DEFCON — a meta por dia usa o preço e o custo do produto.")}
      </p>
    </section>
  );
}
