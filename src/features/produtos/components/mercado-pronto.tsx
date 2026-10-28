/* Compra concluída (Rick, 14/10: "muito feia, pouca informação"): o total em
   destaque, o que virou estoque com o custo e o lucro de cada unidade, os preços
   que subiram ou caíram e a conferência no banco (Open Finance). */
import { Check } from "lucide-react";
import type { ResultadoCompra } from "../api/use-concluir-compra-mutation";
import type { PreviaMercado } from "../lib/mercado";
import { reais } from "./campos";
import { BotaoOuro } from "./quiz-casca";
import { MercadoBanco } from "./mercado-banco";
import { MercadoRendimento } from "./mercado-rendimento";
import { MercadoSobra } from "./mercado-sobra";
import { MercadoSabores } from "./mercado-sabores";
import { MercadoAprendeu } from "./mercado-aprendeu";
import { useSobraEstoqueQuery } from "../api/use-sobra-estoque-query";
import type { ProdutoMercado } from "../lib/mercado";

const un = (n: number) => n.toLocaleString("pt-BR");
const OURO = "#F5B800";
const CARTAO = { background: "#0e0e10", border: "1px solid #26241f" };
const Rotulo = ({ children }: { children: string }) => (
  <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: OURO }}>{children}</span>
);

export interface PrecoDaCompra { nome: string; antes: number; agora: number; diferenca: number; pct: number }
export interface ResumoCompra {
  quando: Date; itens: number; precos: PrecoDaCompra[]; vendas: Record<string, number>;
  receitaNova: { nome: string; rende: number } | null;
  /** desconto no caixa (clube, cupom) */
  desconto?: number;
}

export function MercadoPronto({ resultado, prontos, resumo, faz = [], onProdutos, onDia, onLigarBanco, onEditar }: {
  resultado: ResultadoCompra; prontos: PreviaMercado["prontos"]; resumo: ResumoCompra; faz?: ProdutoMercado[];
  onProdutos: () => void; onDia: () => void; onLigarBanco: () => void; onEditar?: () => void;
}) {
  const feitos = resultado.produtos.filter((p) => p.unidades > 0);
  const hora = resumo.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(":", "h");
  const dia = resumo.quando.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const subiram = resumo.precos.filter((p) => p.diferenca >= 0.01);
  const cairam = resumo.precos.filter((p) => p.diferenca <= -0.01);
  const aMais = subiram.reduce((s, p) => s + p.diferenca, 0);
  // 26/10: o que sobrou de cada ingrediente da receita e quantas levas a mais dá
  const sobra = useSobraEstoqueQuery(feitos.map((p) => p.id), resultado.compra_id);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black text-[#F4F1EA]">
      <div className="min-h-[100dvh] max-w-md mx-auto px-4 flex flex-col gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)" }}>
        {/* herói: o total */}
        <section className="relative overflow-hidden rounded-[24px] px-5 pt-5 pb-5 flex flex-col items-center text-center gap-1"
          style={{ background: "radial-gradient(120% 90% at 50% 0%, rgba(245,184,0,.28), rgba(245,184,0,.04) 55%, #0b0b0c 80%)", border: "1px solid rgba(245,184,0,.4)" }}>
          <span className="w-12 h-12 rounded-full flex items-center justify-center mb-1" style={{ background: OURO, color: "#1A1200", boxShadow: "0 0 30px rgba(245,184,0,.45)" }}>
            <Check className="w-7 h-7" strokeWidth={3.5} />
          </span>
          <Rotulo>COMPRA ANOTADA</Rotulo>
          <span className="text-[30px] leading-none font-extrabold tabular-nums tracking-tight mt-1">{resultado.total > 0 ? reais(resultado.total) : "Sem valor"}</span>
          <span className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>
            {resumo.itens} {resumo.itens === 1 ? "item" : "itens"} · hoje às {hora}
          </span>
          {(resumo.desconto ?? 0) > 0 && (
            <span className="text-[13px] font-extrabold" style={{ color: "#4ADE80" }}>com {reais(resumo.desconto ?? 0)} de desconto</span>
          )}
          {onEditar && (
            <button type="button" onClick={onEditar} className="mt-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-black"
              style={{ background: "rgba(245,184,0,.14)", color: OURO }}>Editar compra</button>
          )}
        </section>

        {/* o que virou estoque */}
        {(feitos.length > 0 || prontos.length > 0) && (
          <section className="rounded-[18px] px-4 py-3.5 flex flex-col gap-3" style={CARTAO}>
            <Rotulo>VIROU ESTOQUE</Rotulo>
            {feitos.map((p) => {
              const venda = resumo.vendas[p.id] ?? 0;
              const lucro = venda > 0 && p.custo_depois > 0 ? venda - p.custo_depois : null;
              const mudou = p.custo_antes > 0 && Math.abs(p.custo_depois - p.custo_antes) >= 0.01;
              return (
                <div key={p.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-black">{p.nome}</span>
                    <span className="text-[20px] leading-none font-extrabold tabular-nums" style={{ color: OURO }}>+{un(p.unidades)}</span>
                  </div>
                  {p.custo_depois > 0 && (
                    <div className="flex items-baseline justify-between gap-2 rounded-[12px] px-3 py-2" style={{ background: "rgba(245,184,0,.08)", border: "1px solid rgba(245,184,0,.3)" }}>
                      <span className="text-[12.5px] font-extrabold" style={{ color: "#b9b3a6" }}>Custo de cada {p.nome.toLowerCase()}</span>
                      <span className="text-[20px] leading-none font-black tabular-nums" style={{ color: OURO }}>{reais(p.custo_depois)}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {p.custo_depois > 0 && (
                      <span className="rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: "#151513", border: "1px solid #2b2924" }}>
                        custa {reais(p.custo_depois)} cada
                        {mudou && <span style={{ color: p.custo_depois > p.custo_antes ? "#FF7A6B" : "#4ADE80" }}> (era {reais(p.custo_antes)})</span>}
                      </span>
                    )}
                    {lucro != null && (
                      <span className="rounded-full px-2.5 py-1 text-[12px] font-extrabold" style={{ background: lucro > 0 ? "rgba(74,222,128,.1)" : "rgba(255,122,107,.12)", color: lucro > 0 ? "#4ADE80" : "#FF7A6B" }}>
                        sobra {reais(lucro)} por venda
                      </span>
                    )}
                  </div>
                  <span className="text-[11.5px] font-bold" style={{ color: "#7b766e" }}>
                    {un(p.receitas)} {p.receitas === 1 ? "leva" : "levas"} da receita
                    {resumo.receitaNova && resumo.receitaNova.nome === p.nome ? " · receita guardada pra próxima compra" : ""}
                  </span>
                  <MercadoAprendeu compraId={resultado.compra_id} produtoId={p.id} nome={p.nome} unidades={p.unidades} />
                  <MercadoSabores produtoId={p.id} nome={p.nome} unidades={p.unidades} />
                  {sobra.data?.[p.id] && p.receitas > 0 && (
                    <MercadoSobra nome={p.nome} itens={sobra.data[p.id] ?? []} porLeva={Math.round(p.unidades / p.receitas)} custo={p.custo_depois} />
                  )}
                </div>
              );
            })}
            {prontos.map((p) => (
              <div key={p.id} className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-black">{p.nome}</span>
                <span className="text-[22px] font-black tabular-nums" style={{ color: OURO }}>+{un(p.unidades)}</span>
              </div>
            ))}
          </section>
        )}
        {feitos.length === 0 && prontos.length === 0 && faz.length > 0 && resultado.total > 0 && (
          <MercadoRendimento compraId={resultado.compra_id} total={resultado.total} faz={faz} />
        )}
        {feitos.length === 0 && prontos.length === 0 && faz.length === 0 && (
          <section className="rounded-[18px] px-4 py-3.5 text-[13px] font-bold" style={{ ...CARTAO, color: "#b9b3a6" }}>
            Tudo guardado no estoque de ingredientes. Quando a receita fechar, vira produto pronto.
          </section>
        )}

        {/* preços */}
        {resumo.precos.length > 0 && (
          <section className="rounded-[18px] px-4 py-3.5 flex flex-col gap-2" style={CARTAO}>
            <Rotulo>PREÇOS DESSA COMPRA</Rotulo>
            <span className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>
              {subiram.length === 0 ? "Nada subiu desde a última compra. 👌" : `${subiram.length} ${subiram.length === 1 ? "item subiu" : "itens subiram"}: ${reais(aMais)} a mais por unidade.`}
              {cairam.length > 0 ? ` ${cairam.length} ${cairam.length === 1 ? "caiu" : "caíram"}.` : ""}
            </span>
            {resumo.precos.map((p) => {
              const sobe = p.diferenca >= 0.01, cai = p.diferenca <= -0.01;
              return (
                <div key={p.nome} className="flex items-center justify-between gap-2 text-[13px] font-bold">
                  <span className="truncate">{p.nome}</span>
                  <span className="tabular-nums shrink-0" style={{ color: sobe ? "#FF7A6B" : cai ? "#4ADE80" : "#7b766e" }}>
                    {reais(p.antes)} → {reais(p.agora)}{sobe || cai ? ` (${sobe ? "+" : "−"}${Math.abs(Math.round(p.pct))}%)` : ""}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        <MercadoBanco compra={{ id: resultado.compra_id, total: resultado.total, dia }} onLigar={onLigarBanco} />

        <div className="flex-grow" />
        <div className="sticky bottom-0 -mx-4 px-4 pt-3 flex flex-col gap-2 bg-black" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
          <BotaoOuro onClick={onDia}>COMEÇAR MEU DIA</BotaoOuro>
          <button type="button" onClick={onProdutos} className="w-full h-12 rounded-2xl font-extrabold" style={{ background: "#121211", border: "1px solid #26241f" }}>
            Voltar pros produtos
          </button>
        </div>
      </div>
    </div>
  );
}
