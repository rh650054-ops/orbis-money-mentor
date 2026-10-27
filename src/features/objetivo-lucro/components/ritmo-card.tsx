/* Full breakdown of the last 60 days (opens under "ver todos os números"). */
import { formatCurrency } from "@/shared/lib/utils";
import type { BaseLucro } from "../types";
import { lucroPorUnidade, nomeUnidade } from "../lib/plano";
import { COR, Linha } from "./ui";

export function RitmoCard({ b }: { b: BaseLucro }) {
  const un1 = nomeUnidade(b.produto_nome, 1);
  const un = nomeUnidade(b.produto_nome);
  const lucroUnid = lucroPorUnidade(b);
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return (
    <section className="rounded-[18px] p-4 mt-1 flex flex-col gap-2" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}` }}>
      <p className="orbis-section" style={{ color: COR.mute }}>Últimos {b.janela_dias} dias</p>
      <Linha k="Dias de venda" v={`${b.dias_vendidos} de ${b.janela_dias}`} />
      <Linha k={`${un.charAt(0).toUpperCase() + un.slice(1)} por dia`} v={`${fmt(b.unid_dia)} · recorde ${fmt(b.recorde_dia)}`} />
      <Linha k="Preço médio" v={formatCurrency(b.ticket)} />
      <Linha k="Faturou" v={formatCurrency(b.vendas)} />
      <div className="pt-2 mt-0.5 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <Linha k={`Custo da receita por ${un1}`} v={formatCurrency(b.custo_receita)} cor={COR.vermelho} />
        <Linha k={`Calote médio por ${un1}`} v={`+ ${formatCurrency(b.calote_unid)}`} cor={COR.vermelho} />
        <Linha k={`Custo real por ${un1}`} v={formatCurrency(b.custo_unid)} cor={COR.vermelho} />
        <Linha k={`Lucro por ${un1}`} v={formatCurrency(lucroUnid)} cor={COR.verde} />
        <Linha k="Lucro por dia de venda" v={formatCurrency(lucroUnid * b.unid_dia)} cor={COR.verde} />
      </div>
      <div className="pt-2 mt-0.5 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
        {b.calote.estimado_banco !== null && <Linha k="Pix/cartão lançados no app" v={formatCurrency(b.calote.app_pix)} />}
        {b.calote.estimado_banco !== null && <Linha k="Caiu na conta do corre" v={formatCurrency(b.entradas_corre)} />}
        {b.calote.estimado_banco !== null && <Linha k="Calote estimado pelo banco" v={formatCurrency(b.calote.estimado_banco)} cor={COR.vermelho} />}
        <Linha k="Calote registrado no app" v={formatCurrency(b.calote.valor)} />
        <Linha k="Recuperado" v={formatCurrency(b.calote.recuperado)} cor={COR.verde} />
        <Linha k="Calote usado na conta" v={`${formatCurrency(b.calote.usado)} · ${formatCurrency(b.calote.por_dia)}/dia`} cor={COR.vermelho} />
      </div>
      {b.banco && (
        <div className="pt-2 mt-0.5 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
          <Linha k="Saídas do corre (banco)" v={formatCurrency(b.gastos_corre)} />
          {b.categorias.slice(0, 4).map((c) => <Linha key={c.categoria} k={`· ${c.categoria}`} v={formatCurrency(c.valor)} />)}
          <Linha k="Gastos pessoais (banco)" v={formatCurrency(b.gastos_pessoais)} />
        </div>
      )}
      <p className="text-[11px] leading-snug mt-1" style={{ color: COR.mute }}>
        {b.custo_extrato !== null
          ? `O banco mostra ${formatCurrency(b.custo_extrato)} por ${un1} em saídas de mercadoria, mas isso inclui estoque comprado e ainda não vendido — por isso o custo usado é o da receita mais o calote médio.`
          : b.banco ? "O extrato ainda não tem saídas do corre suficientes." : "Conectando o banco, a Vant também lê seus gastos de verdade."}
      </p>
    </section>
  );
}
