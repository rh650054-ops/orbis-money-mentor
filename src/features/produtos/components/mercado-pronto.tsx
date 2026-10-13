/* Depois de concluir: o que subiu no estoque e o custo novo de cada um. */
import type { ResultadoCompra } from "../api/use-concluir-compra-mutation";
import type { PreviaMercado } from "../lib/mercado";
import { reais } from "./campos";
import { BotaoOuro } from "./quiz-casca";
import { MercadoCasca } from "./mercado-casca";

const un = (n: number) => n.toLocaleString("pt-BR");

export function MercadoPronto({ resultado, prontos, onProdutos, onDia }: {
  resultado: ResultadoCompra; prontos: PreviaMercado["prontos"]; onProdutos: () => void; onDia: () => void;
}) {
  const feitos = resultado.produtos.filter((p) => p.unidades > 0);
  const nada = feitos.length === 0 && prontos.length === 0;
  return (
    <MercadoCasca titulo="Compra anotada ✅" sub={resultado.total > 0 ? `Total: ${reais(resultado.total)}` : undefined} onVoltar={onProdutos}
      rodape={(
        <>
          <BotaoOuro onClick={onDia}>COMEÇAR MEU DIA</BotaoOuro>
          <button type="button" onClick={onProdutos} className="w-full h-12 rounded-2xl font-extrabold"
            style={{ background: "#121211", border: "1px solid #26241f" }}>
            Voltar pros produtos
          </button>
        </>
      )}>
      {feitos.map((p) => (
        <div key={p.id} className="rounded-[18px] px-4 py-3.5 flex flex-col gap-1"
          style={{ background: "linear-gradient(170deg, #1a1305, #0e0e10 70%)", border: "1px solid rgba(245,184,0,.38)" }}>
          <span className="text-[20px] font-black" style={{ color: "#F5B800" }}>+{un(p.unidades)} {p.nome} no estoque</span>
          <span className="text-[12px] font-bold" style={{ color: "#b9b3a6" }}>
            {un(p.receitas)} {p.receitas === 1 ? "receita feita" : "receitas feitas"} com a compra
          </span>
          {p.custo_depois > 0 && Math.abs(p.custo_depois - p.custo_antes) >= 0.01 && (
            <span className="text-[12px] font-bold" style={{ color: "#b9b3a6" }}>
              Custo de cada: {p.custo_antes > 0 ? `${reais(p.custo_antes)} → ` : ""}{reais(p.custo_depois)}
            </span>
          )}
        </div>
      ))}
      {prontos.map((p) => (
        <div key={p.id} className="rounded-[18px] px-4 py-3 text-[17px] font-black" style={{ background: "#0e0e10", border: "1px solid #26241f" }}>
          +{un(p.unidades)} {p.nome} no estoque
        </div>
      ))}
      {nada && (
        <p className="text-[14px] font-bold" style={{ color: "#b9b3a6" }}>
          Tudo guardado no estoque de ingredientes.
        </p>
      )}
    </MercadoCasca>
  );
}
