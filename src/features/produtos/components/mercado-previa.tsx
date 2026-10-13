/* Prévia ao vivo: quantas receitas/unidades a compra vira — a mesma conta que o
   banco faz ao concluir. */
import type { PreviaMercado } from "../lib/mercado";
import { reais } from "./campos";

const un = (n: number) => n.toLocaleString("pt-BR");
const receitasTxt = (n: number) => `${un(n)} ${n === 1 ? "receita" : "receitas"}`;
const lista = (nomes: string[]) =>
  nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;

export function MercadoPrevia({ previa, totalItens }: { previa: PreviaMercado; totalItens?: number }) {
  const sobem = previa.produtos.filter((p) => p.receitas > 0);
  const travados = previa.produtos.filter((p) => p.receitas === 0 && p.faltam.length > 0);
  const nada = sobem.length === 0 && previa.prontos.length === 0;

  return (
    <div className="rounded-[18px] px-4 py-3.5 flex flex-col gap-2"
      style={{ background: "linear-gradient(170deg, #1a1305, #0e0e10 70%)", border: "1px solid rgba(245,184,0,.38)" }}>
      <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>ISSO VIRA NO ESTOQUE</span>
      {nada && (
        <span className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>
          Anota o que tá no carrinho e a VANT mostra quanto dá pra fazer.
        </span>
      )}
      {sobem.map((p) => (
        <div key={p.id} className="flex justify-between items-baseline gap-2">
          <span className="text-[14px] font-extrabold">{p.nome} · {receitasTxt(p.receitas)}</span>
          <span className="text-[20px] font-black tabular-nums" style={{ color: "#F5B800" }}>→ {un(p.unidades)} un</span>
        </div>
      ))}
      {previa.prontos.map((p) => (
        <div key={p.id} className="flex justify-between items-baseline gap-2">
          <span className="text-[14px] font-extrabold">{p.nome}</span>
          <span className="text-[20px] font-black tabular-nums" style={{ color: "#F5B800" }}>+{un(p.unidades)} un</span>
        </div>
      ))}
      {travados.map((p) => (
        <span key={p.id} className="text-[12px] font-bold" style={{ color: "#b9b3a6" }}>
          {p.nome}: falta {lista(p.faltam)} pra fechar a receita (o resto fica guardado no estoque de ingredientes).
        </span>
      ))}
      {totalItens !== undefined && totalItens > 0 && (
        <span className="text-[11.5px] font-bold" style={{ color: "#7b766e" }}>Até agora: {reais(totalItens)}</span>
      )}
    </div>
  );
}
