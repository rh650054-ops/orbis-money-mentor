/* The Vant's plan: work-days control, strong weekdays, the numbered steps from the AI,
   the biggest risk, and the stock the mission needs. */
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import type { BaseLucro, PlanoIa } from "../types";
import { nomeUnidade, type PlanoLucro } from "../lib/plano";
import { Passo } from "./passo-meta";
import { COR, Linha } from "./ui";

const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const NOMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

interface Props {
  b: BaseLucro;
  p: PlanoLucro;
  ia: PlanoIa | null;
  dias: number;
  diasTrabalho: number;
  onDiasTrabalho: (n: number) => void;
}

export function PlanoIaCard({ b, p, ia, dias, diasTrabalho, onDiasTrabalho }: Props) {
  const un = nomeUnidade(b.produto_nome);
  const fortes = new Set((ia?.melhores_dias ?? []).map((d) => NOMES.findIndex((n) => d.toLowerCase().startsWith(n.slice(0, 3)))));
  const maxSemana = Math.max(1, ...b.semana.map((s) => s.unid_dia));

  return (
    <>
      <div className="mt-5 rounded-[18px] px-4 py-3.5 flex items-center justify-between gap-3" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}` }}>
        <span className="min-w-0">
          <span className="block orbis-section" style={{ color: COR.mute }}>Dias de trabalho</span>
          <span className="block text-[12px] mt-0.5" style={{ color: COR.sub }}>
            {ia?.dias_trabalho && ia.dias_trabalho !== diasTrabalho ? `a Vant sugere ${ia.dias_trabalho}` : `seu ritmo: ${Math.round(b.frequencia * 100)}% dos dias`}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 shrink-0">
          <Passo onClick={() => onDiasTrabalho(Math.max(1, diasTrabalho - 1))} label="Menos um dia de trabalho"><Minus className="w-4 h-4" /></Passo>
          <span className="vant-missao-num w-[72px] text-center text-[26px] leading-none whitespace-nowrap" style={{ color: COR.ouro }}>{diasTrabalho}<span className="text-[16px]" style={{ color: COR.mute }}>/{dias}</span></span>
          <Passo onClick={() => onDiasTrabalho(Math.min(dias, diasTrabalho + 1))} label="Mais um dia de trabalho"><Plus className="w-4 h-4" /></Passo>
        </span>
      </div>

      {b.semana.length > 0 && (
        <div className="mt-2 rounded-[18px] px-4 pt-3 pb-2.5" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}` }}>
          <p className="orbis-section" style={{ color: COR.mute }}>Seus dias fortes <span className="normal-case tracking-normal font-semibold" style={{ color: COR.sub }}>· {un} por dia</span></p>
          <div className="mt-2.5 flex items-end justify-between gap-1.5 h-16">
            {Array.from({ length: 7 }, (_, dow) => {
              const s = b.semana.find((x) => x.dow === dow);
              const h = s ? Math.max(6, (s.unid_dia / maxSemana) * 44) : 4;
              const forte = fortes.has(dow) || (!ia && s !== undefined && s.unid_dia >= b.unid_dia);
              return (
                <div key={dow} className="flex-1 flex flex-col items-center gap-1">
                  <span className="vant-missao-num text-[13px] leading-none" style={{ color: forte ? COR.ouro : COR.mute }}>{s ? Math.round(s.unid_dia) : ""}</span>
                  <span className="w-full rounded-[3px] vant-tick" style={{ height: h, background: forte ? `linear-gradient(180deg,#FFC63A,${COR.ouro})` : "rgba(255,255,255,.12)", boxShadow: forte ? `0 0 12px ${COR.ouro}55` : undefined }} />
                  <span className="text-[10px] font-black uppercase tracking-[.06em]" style={{ color: forte ? COR.texto : COR.mute }}>{DOW[dow]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ia && ia.passos.length > 0 && (
        <section className="vant-hud mt-3 rounded-[20px] p-4 pt-5" style={{ border: "1px solid rgba(245,184,0,.3)" }}>
          <span className="vant-canto" />
          <p className="orbis-section inline-flex items-center gap-2" style={{ color: COR.ouro }}><span className="w-4 h-px" style={{ background: COR.ouro }} /> Plano de ataque</p>
          <ol className="mt-3 flex flex-col">
            {ia.passos.map((s, i) => (
              <li key={i} className="flex gap-3 relative pb-4 last:pb-0">
                {i < ia.passos.length - 1 && <span className="absolute left-[15px] top-8 bottom-0 w-px" style={{ background: "rgba(245,184,0,.25)" }} />}
                <span className="vant-missao-num w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[15px] pt-0.5" style={{ background: "#0b0b0d", color: COR.ouro, border: `1.5px solid ${COR.ouro}`, boxShadow: `0 0 12px ${COR.ouro}44` }}>{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 pt-1">
                  <span className="block text-[14.5px] font-black leading-tight" style={{ color: COR.texto }}>{s.titulo}</span>
                  <span className="block text-[12.5px] mt-1 leading-snug" style={{ color: COR.sub }}>{s.texto}</span>
                </span>
              </li>
            ))}
          </ol>
          {ia.alerta && (
            <p className="mt-4 rounded-[12px] px-3 py-2.5 text-[12.5px] leading-snug flex gap-2" style={{ background: "rgba(229,115,127,.1)", border: "1px solid rgba(229,115,127,.35)", color: COR.texto }}>
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: COR.vermelho }} /> <span><b style={{ color: COR.vermelho }}>Risco: </b>{ia.alerta}</span>
            </p>
          )}
        </section>
      )}

      {p.totalUnid !== null && (
        <section className="mt-3 rounded-[18px] px-4 py-3.5 flex flex-col gap-1.5" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}` }}>
          <p className="orbis-section mb-1" style={{ color: COR.mute }}>Munição · estoque pra missão</p>
          <Linha k={`Total de ${un}`} v={p.totalUnid} />
          <Linha k="Você já tem" v={b.estoque} />
          <Linha k="Falta produzir" v={p.produzir ?? 0} cor={COR.ouro} />
          {(p.custoProduzir ?? 0) > 0 && <Linha k="Insumos (pela receita)" v={`~${formatCurrency(p.custoProduzir ?? 0)}`} />}
        </section>
      )}
    </>
  );
}
