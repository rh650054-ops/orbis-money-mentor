/* Verdict + "how many per day" for the chosen number of work days. */
import { Minus, Plus } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import type { BaseLucro } from "../types";
import { nomeUnidade, type Nivel, type PlanoLucro } from "../lib/plano";
import { Passo } from "./passo-meta";
import { COR, Linha } from "./ui";
import { brl0 } from "../lib/formato";

interface Props {
  b: BaseLucro;
  p: PlanoLucro;
  alvo: number;
  dias: number;
  diasTrabalho: number;
  onDiasTrabalho: (n: number) => void;
}

const NIVEL: Record<Nivel, { cor: string; titulo: string }> = {
  tranquilo: { cor: COR.verde, titulo: "Dá com seu ritmo" },
  puxado: { cor: COR.ouro, titulo: "Puxado, mas você já fez isso" },
  acima: { cor: COR.vermelho, titulo: "Acima do seu recorde" },
  "sem-historico": { cor: COR.sub, titulo: "Sua meta por dia" },
};

export function PlanoCard({ b, p, alvo, dias, diasTrabalho, onDiasTrabalho }: Props) {
  const un = nomeUnidade(b.produto_nome);
  const n = NIVEL[p.nivel];
  const temMedia = p.nivel !== "sem-historico";
  return (
    <>
      {temMedia && (
        <section className="rounded-[18px] p-4 mt-3" style={{ background: p.faltaNaMedia > 0 ? "linear-gradient(180deg,#1a1012,#131211)" : "linear-gradient(180deg,#0f1a13,#131211)", border: `1px solid ${p.faltaNaMedia > 0 ? "rgba(229,115,127,.35)" : "rgba(61,214,140,.35)"}` }}>
          <p className="text-[13px] leading-snug" style={{ color: COR.sub }}>
            Na sua média, em {diasTrabalho} dias de trabalho você lucra <b className="orbis-num text-foreground">{brl0(p.projecao)}</b>.
          </p>
          <p className="text-[15px] font-extrabold mt-1" style={{ color: p.faltaNaMedia > 0 ? COR.vermelho : COR.verde }}>
            {p.faltaNaMedia > 0 ? `Faltam ${brl0(p.faltaNaMedia)} pros ${brl0(alvo)}` : "Sua média já bate o objetivo"}
          </p>
        </section>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 px-0.5">
        <span className="text-[13.5px] font-bold" style={{ color: COR.texto }}>Vou trabalhar</span>
        <span className="inline-flex items-center gap-1">
          <Passo onClick={() => onDiasTrabalho(Math.max(1, diasTrabalho - 1))} label="Menos um dia de trabalho"><Minus className="w-4 h-4" /></Passo>
          <span className="orbis-num w-16 text-center text-[15px] font-black">{diasTrabalho} de {dias}</span>
          <Passo onClick={() => onDiasTrabalho(Math.min(dias, diasTrabalho + 1))} label="Mais um dia de trabalho"><Plus className="w-4 h-4" /></Passo>
        </span>
      </div>

      <section className="rounded-[18px] p-4 mt-3" style={{ background: COR.caixa, border: `1.5px solid ${n.cor}` }}>
        <p className="orbis-section" style={{ color: n.cor }}>{n.titulo}</p>
        <p className="orbis-num text-[30px] font-black leading-none mt-2 tracking-tight">
          {p.unidDia ?? "—"} <span className="text-[16px] font-extrabold" style={{ color: COR.sub }}>{un} por dia</span>
        </p>
        <p className="text-[12.5px] mt-1.5" style={{ color: COR.sub }}>
          = <b className="orbis-num text-foreground">{formatCurrency(p.precisaDia)}</b> de lucro por dia de trabalho
        </p>
        <p className="text-[12.5px] mt-2 leading-snug" style={{ color: COR.mute }}>{dica(b, p, dias, un)}</p>
      </section>

      {p.totalUnid !== null && (
        <section className="rounded-[18px] p-4 mt-3 flex flex-col gap-2" style={{ background: COR.caixa, border: `1px solid ${COR.linha}` }}>
          <p className="orbis-section" style={{ color: COR.mute }}>Estoque pro desafio</p>
          <Linha k={`Total de ${un}`} v={p.totalUnid} />
          <Linha k="Você já tem" v={b.estoque} />
          <Linha k="Falta produzir" v={p.produzir ?? 0} cor={COR.ouro} />
          {(p.custoProduzir ?? 0) > 0 && <Linha k="Insumos (pela receita)" v={`~${formatCurrency(p.custoProduzir ?? 0)}`} />}
        </section>
      )}
    </>
  );
}

function dica(b: BaseLucro, p: PlanoLucro, dias: number, un: string): string {
  const media = b.unid_dia.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (p.nivel === "sem-historico") return "Ainda sem histórico de vendas — use como referência.";
  if (p.nivel === "tranquilo") return `Sua média é ${media} ${un} por dia. É manter o ritmo.`;
  const extra = p.diasNaMedia !== null && p.diasNaMedia <= dias
    ? ` Ou trabalhe ${p.diasNaMedia} dos ${dias} dias no seu ritmo normal.`
    : p.diasNaMedia !== null ? ` Só no ritmo normal, precisaria de ${p.diasNaMedia} dias de trabalho — mais que os ${dias} do prazo.` : "";
  if (p.nivel === "puxado") return `Sua média é ${media}, mas seu recorde é ${b.recorde_dia} num dia.${extra}`;
  return `Seu recorde é ${b.recorde_dia} num dia. Aumente os dias de trabalho ou estique o prazo.${extra}`;
}
