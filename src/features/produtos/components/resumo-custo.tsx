/* VANT Receita Inteligente (24/11): the recipe's cost, live, while the seller fills it. A missing
   quantity or price makes it PARTIAL, and it says so; it is never shown as the final cost. With a sale
   price, the estimated contribution margin per unit, with what it counts (only these ingredients). */
import type { ResumoCusto } from "../lib/receitas";
import { reais } from "./campos";

const lista = (n: string[]) => (n.length <= 2 ? n.join(" e ") : `${n.slice(0, 2).join(", ")} e mais ${n.length - 2}`);

export function ResumoDoCusto({ r, rende, nomeProduto, precoVenda, fixo }: {
  r: ResumoCusto; rende: number; nomeProduto: string; precoVenda?: number;
  /** stays visible at the bottom while scrolling (the quiz; the product sheet has its own floating button) */
  fixo?: boolean;
}) {
  const parcial = !r.completo;
  const margem = precoVenda && precoVenda > 0 && r.porUnidade > 0 ? precoVenda - r.porUnidade : null;
  const Linha = ({ k, v, forte }: { k: string; v: string; forte?: boolean }) => (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-[12.5px] font-bold" style={{ color: "#b9b3a6" }}>{k}</span>
      <span className={`${forte ? "text-[21px]" : "text-[14px]"} font-black tabular-nums`} style={{ color: forte ? "#F5B800" : "#F4F1EA" }}>{v}</span>
    </div>
  );
  return (
    <div className={`${fixo ? "sticky bottom-2 z-10 shadow-[0_-8px_24px_rgba(0,0,0,.6)]" : ""} rounded-[18px] px-4 py-3 flex flex-col gap-1.5`}
      style={{ background: "linear-gradient(170deg, #1a1305, #0e0e10 70%)", border: `1px solid ${parcial ? "rgba(245,184,0,.38)" : "rgba(61,214,140,.45)"}` }}>
      <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>CUSTO DA RECEITA</span>
      <Linha k="Custo da receita" v={reais(r.total)} />
      <Linha k="Rendimento" v={rende >= 1 ? `${rende.toLocaleString("pt-BR")} ${nomeProduto}` : "—"} />
      <Linha k={parcial ? "Custo parcial por unidade" : "Custo por unidade"} v={rende >= 1 ? reais(r.porUnidade) : "—"} forte />
      {parcial && (
        <p className="text-[11.5px] font-bold leading-snug" style={{ color: "#F5B800" }}>
          Custo parcial — faltam ingredientes para calcular o custo completo.
          {r.faltaQtd.length > 0 && <span style={{ color: "#b9b3a6" }}> Falta quanto usa de {lista(r.faltaQtd)}.</span>}
          {r.faltaPreco.length > 0 && <span style={{ color: "#b9b3a6" }}> Falta o preço de {lista(r.faltaPreco)}.</span>}
          {!(rende >= 1) && <span style={{ color: "#b9b3a6" }}> Falta dizer quantas unidades a receita rende.</span>}
        </p>
      )}
      {margem != null && (
        <div className="flex flex-col gap-0.5 pt-1.5" style={{ borderTop: "1px solid #2a2618" }}>
          <Linha k={parcial ? "Margem estimada (custo parcial)" : "Margem de contribuição estimada"} v={`${reais(margem)} por un`} />
          <span className="text-[10.5px] font-bold leading-snug" style={{ color: "#7b766e" }}>
            Venda de {reais(precoVenda ?? 0)} menos os ingredientes desta receita. Não inclui gás, taxas, transporte nem o seu tempo: não é o lucro líquido.
          </span>
        </div>
      )}
    </div>
  );
}
