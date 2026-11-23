/* "Compra registrada!" (23/11/2026): o total em destaque, o que entrou no estoque, o convite pra
   produzir agora ou depois, os preços que subiram ou caíram e a conferência no banco (Open Finance).
   Desde 23/11 a compra não fabrica nada sozinha. */
import { Check } from "lucide-react";
import type { ResultadoCompra } from "../api/use-concluir-compra-mutation";
import type { PreviaMercado } from "../lib/mercado";
import { reais } from "./campos";
import { BotaoOuro } from "./quiz-casca";
import { MercadoBanco } from "./mercado-banco";
import { MercadoRendimento } from "./mercado-rendimento";
import { MercadoAprendeu } from "./mercado-aprendeu";
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

export function MercadoPronto({ resultado, prontos, resumo, faz = [], onProdutos, onDia, onLigarBanco, onEditar, onProduzir }: {
  resultado: ResultadoCompra; prontos: PreviaMercado["prontos"]; resumo: ResumoCompra; faz?: ProdutoMercado[];
  onProdutos: () => void; onDia: () => void; onLigarBanco: () => void; onEditar?: () => void;
  /** 23/11: "Produzir agora" → production screen with these products first */
  onProduzir?: (ids: string[]) => void;
}) {
  // 23/11: recipe products the purchase was for (nothing was manufactured); without recipe: "quantas vai fazer"
  const feitos = resultado.produtos;
  const semReceita = faz.filter((p) => !feitos.some((f) => f.id === p.id));
  const hora = resumo.quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(":", "h");
  const dia = resumo.quando.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const subiram = resumo.precos.filter((p) => p.diferenca >= 0.01);
  const cairam = resumo.precos.filter((p) => p.diferenca <= -0.01);
  const aMais = subiram.reduce((s, p) => s + p.diferenca, 0);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black text-[#F4F1EA]">
      <div className="min-h-[100dvh] max-w-md mx-auto px-4 flex flex-col gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)" }}>
        {/* herói: o total */}
        <section className="relative overflow-hidden rounded-[24px] px-5 pt-5 pb-5 flex flex-col items-center text-center gap-1"
          style={{ background: "radial-gradient(120% 90% at 50% 0%, rgba(245,184,0,.28), rgba(245,184,0,.04) 55%, #0b0b0c 80%)", border: "1px solid rgba(245,184,0,.4)" }}>
          <span className="w-12 h-12 rounded-full flex items-center justify-center mb-1" style={{ background: OURO, color: "#1A1200", boxShadow: "0 0 30px rgba(245,184,0,.45)" }}>
            <Check className="w-7 h-7" strokeWidth={3.5} />
          </span>
          <Rotulo>COMPRA REGISTRADA!</Rotulo>
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

        {/* 23/11: the purchase only registers. Ready products bought go to stock; what the seller
            makes is produced now or later, on the production screen, with the real numbers. */}
        {prontos.length > 0 && (
          <section className="rounded-[18px] px-4 py-3.5 flex flex-col gap-2" style={CARTAO}>
            <Rotulo>ENTROU NO ESTOQUE</Rotulo>
            {prontos.map((p) => (
              <div key={p.id} className="flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-black">{p.nome}</span>
                <span className="text-[22px] font-black tabular-nums" style={{ color: OURO }}>+{un(p.unidades)}</span>
              </div>
            ))}
          </section>
        )}
        {resultado.producao_desfeita.length > 0 && (
          <section className="rounded-[18px] px-4 py-3.5 text-[13px] font-bold flex flex-col gap-1" style={{ ...CARTAO, border: "1px solid rgba(245,184,0,.45)" }}>
            <Rotulo>PRODUÇÃO AUTOMÁTICA DESFEITA</Rotulo>
            <span style={{ color: "#b9b3a6" }}>
              Essa compra tinha virado {resultado.producao_desfeita.map((p) => `${un(p.unidades)} ${p.nome}`).join(", ")} sozinha. Agora a compra só registra os ingredientes:
              os ingredientes voltaram para o estoque. Registre a produção de novo, com o que você realmente fez.
            </span>
          </section>
        )}
        {feitos.length > 0 && (
          <section className="rounded-[18px] px-4 py-3.5 flex flex-col gap-3" style={CARTAO}>
            <Rotulo>QUER PRODUZIR AGORA?</Rotulo>
            {feitos.map((p) => (
              <div key={p.id} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-black">{p.nome}</span>
                  {p.receita_completa && p.pode_unidades != null && (
                    <span className="text-[13px] font-extrabold" style={{ color: OURO }}>dá pra fazer até {un(p.pode_unidades)}</span>
                  )}
                </div>
                <span className="text-[12px] font-bold" style={{ color: p.receita_completa ? "#7b766e" : "#FF7A6B" }}>
                  {!p.receita_completa ? "Receita incompleta: complete a ficha antes de produzir."
                    : p.pode_unidades == null ? "Cada sabor tem o seu rendimento: diga quanto fez de cada um."
                    : p.custo_depois > 0 ? `Custo de cada um: ${reais(p.custo_depois)}` : "Os ingredientes já estão no estoque."}
                </span>
                {(p.pode_unidades ?? 0) > 0 && <MercadoAprendeu compraId={resultado.compra_id} produtoId={p.id} nome={p.nome} unidades={p.pode_unidades ?? 0} />}
              </div>
            ))}
            <BotaoOuro onClick={() => onProduzir?.(feitos.map((p) => p.id))}>PRODUZIR AGORA</BotaoOuro>
            <span className="text-[12px] font-bold text-center" style={{ color: "#7b766e" }}>Ou depois: Produtos › Estoque › Produzir.</span>
          </section>
        )}
        {feitos.length === 0 && semReceita.length > 0 && resultado.total > 0 && prontos.length === 0 && (
          <MercadoRendimento compraId={resultado.compra_id} total={resultado.total} faz={semReceita} />
        )}
        {feitos.length === 0 && prontos.length === 0 && semReceita.length === 0 && (
          <section className="rounded-[18px] px-4 py-3.5 text-[13px] font-bold" style={{ ...CARTAO, color: "#b9b3a6" }}>
            Tudo guardado no estoque de ingredientes. Quando quiser, registre a produção.
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
