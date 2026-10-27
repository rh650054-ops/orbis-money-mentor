/* "Seu corre nos últimos 60 dias": the base the plan is built on. */
import { formatCurrency } from "@/shared/lib/utils";
import type { BaseLucro } from "../types";
import { lucroPorUnidade, nomeUnidade } from "../lib/plano";
import { COR, Linha } from "./ui";

export function RitmoCard({ b }: { b: BaseLucro }) {
  const un1 = nomeUnidade(b.produto_nome, 1);
  const un = nomeUnidade(b.produto_nome);
  const lucroUnid = lucroPorUnidade(b);
  if (b.dias_vendidos <= 0) {
    return (
      <section className="rounded-[18px] p-4 mt-4" style={{ background: COR.caixa, border: `1px solid ${COR.linha}` }}>
        <p className="orbis-section" style={{ color: COR.mute }}>Seu corre</p>
        <p className="text-[13px] mt-2 leading-snug" style={{ color: COR.sub }}>
          Ainda não tenho vendas suas no DEFCON. Uso o preço e o custo do produto ({formatCurrency(lucroUnid)} de lucro por {un1}) — depois de uns dias de venda o plano fica do seu jeito.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-[18px] p-4 mt-4 flex flex-col gap-2" style={{ background: COR.caixa, border: `1px solid ${COR.linha}` }}>
      <p className="orbis-section" style={{ color: COR.mute }}>Seu corre nos últimos {b.janela_dias} dias</p>
      <Linha k="Dias de venda" v={`${b.dias_vendidos} de ${b.janela_dias}`} />
      <Linha k={`${cap(un)} por dia`} v={`${fmt(b.unid_dia)} · recorde ${fmt(b.recorde_dia)}`} />
      <Linha k="Preço médio" v={formatCurrency(b.ticket)} />
      <Linha k={`Custo por ${un1}`} v={formatCurrency(b.custo_unid)} cor={COR.vermelho} />
      <div className="pt-2 mt-0.5 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <Linha k={`Lucro por ${un1}`} v={formatCurrency(lucroUnid)} cor={COR.verde} />
        <Linha k="Lucro por dia de venda" v={formatCurrency(lucroUnid * b.unid_dia)} cor={COR.verde} />
      </div>
      <p className="text-[11.5px] leading-snug mt-1" style={{ color: COR.mute }}>
        {b.fonte_custo === "extrato"
          ? `Custo real pelo seu banco: ${formatCurrency(b.gastos_corre)} de gastos do corre ÷ ${fmt(b.unidades)} ${un}.${b.custo_receita > 0 ? ` Pela receita seria ${formatCurrency(b.custo_receita)} — o banco pega também gasolina, embalagem e o que mais sai do corre.` : ""}`
          : b.banco
            ? "Custo pela receita do produto (o extrato ainda não tem gastos do corre suficientes)."
            : "Custo pela receita do produto. Conectando o banco, a Vant usa o custo real do seu corre."}
      </p>
    </section>
  );
}

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
