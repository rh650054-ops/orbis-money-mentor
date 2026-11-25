/* VANT Receita Inteligente — "Seu resultado" (25/11, Rick item 6). Live while the seller fills it:
   cost of the recipe, units, cost per unit, sale price, what is left per unit and the estimated
   contribution margin. A missing quantity, price, yield or an unconfirmed old line makes it PARTIAL:
   then no "sobra" or margin is shown as a definitive result. "Ver detalhes" opens the composition. */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ResumoCusto } from "../lib/receitas";
import { reais } from "./campos";

const lista = (n: string[]) => (n.length <= 2 ? n.join(" e ") : `${n.slice(0, 2).join(", ")} e mais ${n.length - 2}`);
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function ResumoDoCusto({ r, rende, nomeProduto, precoVenda, fixo }: {
  r: ResumoCusto; rende: number; nomeProduto: string; precoVenda?: number;
  /** stays visible at the bottom while scrolling (the quiz; the product sheet has its own floating button) */
  fixo?: boolean;
}) {
  const [detalhes, setDetalhes] = useState(false);
  const parcial = !r.completo;
  const valido = rende >= 1;
  const preco = precoVenda && precoVenda > 0 ? precoVenda : 0;
  const sobra = !parcial && preco > 0 ? preco - r.porUnidade : null;
  const Linha = ({ k, v, forte, cor }: { k: string; v: string; forte?: boolean; cor?: string }) => (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-[12.5px] font-bold" style={{ color: "#b9b3a6" }}>{k}</span>
      <span className={`${forte ? "text-[21px]" : "text-[14px]"} font-black tabular-nums`} style={{ color: cor ?? (forte ? "#F5B800" : "#F4F1EA") }}>{v}</span>
    </div>
  );
  return (
    <div className={`${fixo ? "sticky bottom-2 z-10 shadow-[0_-8px_24px_rgba(0,0,0,.6)]" : ""} rounded-[18px] px-4 py-3 flex flex-col gap-1.5`}
      style={{ background: "linear-gradient(170deg, #1a1305, #0e0e10 70%)", border: `1px solid ${parcial ? "rgba(245,184,0,.38)" : "rgba(61,214,140,.45)"}` }}>
      <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>SEU RESULTADO</span>
      <Linha k="Custo total da receita" v={reais(r.total)} />
      <Linha k="Quantidade produzida" v={valido ? `${rende.toLocaleString("pt-BR")} ${nomeProduto}` : "—"} />
      {/* no yield = no division: never a made-up cost per unit */}
      <Linha k={parcial ? "Custo parcial por unidade" : "Custo por unidade"} v={valido ? reais(r.porUnidade) : "—"} forte />
      {preco > 0 && <Linha k="Preço de venda" v={reais(preco)} />}
      {sobra != null && (
        <>
          <Linha k="Sobra por unidade" v={reais(sobra)} cor={sobra > 0 ? "#3DD68C" : "#FF6B5E"} />
          <Linha k="Margem de contribuição estimada" v={pct((sobra / preco) * 100)} cor={sobra > 0 ? "#3DD68C" : "#FF6B5E"} />
          <span className="text-[10.5px] font-bold leading-snug" style={{ color: "#7b766e" }}>
            Venda menos o custo desta receita. Não inclui o que não está aqui (transporte, aluguel…): não é o lucro líquido.
          </span>
        </>
      )}
      {parcial && (
        <p className="text-[11.5px] font-bold leading-snug" style={{ color: "#F5B800" }}>
          {preco > 0 ? "Custo parcial — faltam informações para calcular sua margem real." : "Custo parcial — faltam ingredientes para calcular o custo completo."}
          {r.faltaQtd.length > 0 && <span style={{ color: "#b9b3a6" }}> Falta quanto usa de {lista(r.faltaQtd)}.</span>}
          {r.faltaPreco.length > 0 && <span style={{ color: "#b9b3a6" }}> Falta o preço de {lista(r.faltaPreco)}.</span>}
          {r.confirmar.length > 0 && <span style={{ color: "#b9b3a6" }}> Confirme se {lista(r.confirmar)} vai por receita ou em cada unidade.</span>}
          {!valido && <span style={{ color: "#b9b3a6" }}> Falta dizer quantas unidades a receita rende.</span>}
        </p>
      )}
      <button type="button" aria-expanded={detalhes} onClick={() => setDetalhes(!detalhes)} className="self-start inline-flex items-center gap-1 text-[12px] font-extrabold pt-0.5" style={{ color: "#F5B800" }}>
        Ver detalhes <ChevronDown className={`w-3.5 h-3.5 transition-transform ${detalhes ? "rotate-180" : ""}`} />
      </button>
      {detalhes && (
        <div className="flex flex-col gap-1 pt-1.5 text-[12px] font-bold" style={{ borderTop: "1px solid #2a2618", color: "#b9b3a6" }}>
          <Linha k="Ingredientes da receita" v={reais(r.lote)} />
          <Linha k={`Custos de cada unidade${valido ? ` (× ${rende.toLocaleString("pt-BR")})` : ""}`} v={reais(r.unidades)} />
          <Linha k="Custos sem estoque" v={reais(r.extras)} />
          <Linha k="Custo total da receita" v={reais(r.total)} />
          <span className="text-[11px] leading-snug">{valido ? `${reais(r.total)} ÷ ${rende.toLocaleString("pt-BR")} = ${reais(r.porUnidade)} por unidade.` : "Sem o rendimento a VANT não divide o custo."}</span>
        </div>
      )}
    </div>
  );
}
