/* The recipe of someone who makes the product (quiz and product sheet). Approved design kept.
   22/11 (Etapa 2): the yield is a field the SELLER fills ("Essa receita rende 20"); no ingredient
   changes it. Each line separates what is bought, what is used in a batch and the price (optional:
   it can come later from the market). Lines without quantity stay as a draft and never count as
   consumption. Same ingredient under a slightly different name reuses the saved one. */
import { Plus } from "lucide-react";
import { useIngredientesGuardadosQuery } from "../api/use-ingredientes-guardados-query";
import { custoPorUnidade } from "../lib/conta";
import { ehRascunho, linhasRepetidas, novoIngrediente, totalDaReceita, type IngredienteRascunho } from "../lib/receitas";
import { reais } from "./campos";
import { LinhaIngrediente } from "./linha-ingrediente";
import { MiniNumero } from "./mini-campos";
import { ResultadoOuro } from "./quiz-casca";

export { LinhaIngrediente } from "./linha-ingrediente";

export function EditorReceita({ itens, rende, onItens, onRende, estoques, nomeProduto = "unidades" }: {
  itens: IngredienteRascunho[]; rende: number;
  onItens: (i: IngredienteRascunho[]) => void; onRende: (n: number) => void;
  /** stock of each ingredient by name (lower case), when it exists */
  estoques?: Map<string, number>;
  nomeProduto?: string;
}) {
  const guardados = useIngredientesGuardadosQuery().data ?? [];
  const mudar = (i: number, m: Partial<IngredienteRascunho>) => onItens(itens.map((it, j) => (j === i ? { ...it, ...m } : it)));
  const repetidas = linhasRepetidas(itens);
  const total = totalDaReceita(itens);
  const custo = custoPorUnidade(total, rende);
  const rascunhos = itens.filter(ehRascunho).length;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 rounded-[14px] px-3 py-3" style={{ background: "#151515", border: `1px solid ${rende >= 1 ? "#26241f" : "#F5B800"}` }}>
        <span className="text-[14px] font-extrabold flex-1">Essa receita rende</span>
        <MiniNumero valor={rende} largura={76} exemplo="?" rotulo="Quanto a receita rende" onChange={(n) => onRende(Math.max(0, Math.round(n)))} />
        <span className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>{nomeProduto}</span>
      </div>
      {!(rende >= 1) && <p className="text-[11.5px] font-bold px-1" style={{ color: "#F5B800" }}>Diga quantas saem de uma leva. Só você sabe esse número.</p>}
      {itens.map((it, i) => (
        <LinhaIngrediente key={i} it={it} rende={rende} nomeProduto={nomeProduto} repetido={repetidas.has(i)}
          estoque={estoques?.get(it.nome.trim().toLowerCase())} onMudar={(m) => mudar(i, m)}
          sugestoes={guardados.filter((g) => !itens.some((x, j) => j !== i && x.id === g.id))} />
      ))}
      <button type="button" onClick={() => onItens([...itens, novoIngrediente("", 0)])}
        className="flex items-center gap-1 text-[12.5px] font-black px-0.5 py-1 self-start" style={{ color: "#F5B800" }}>
        <Plus className="w-3.5 h-3.5" /> adicionar ingrediente
      </button>
      {custo > 0 && rende >= 1
        ? <ResultadoOuro rotulo={`Cada ${nomeProduto === "unidades" ? "uma" : nomeProduto} te custa`} valor={reais(custo)}
            detalhe={`${rende} ${nomeProduto} por ${reais(total)}${rascunhos ? ` · ${rascunhos} ingrediente${rascunhos > 1 ? "s" : ""} ainda sem quantidade` : ""}`} />
        : <p className="text-[11.5px] font-bold px-1" style={{ color: "#8A8A8A" }}>Sem preço? Tudo bem: o custo aparece quando você anotar a compra no "Tô no mercado".</p>}
    </div>
  );
}
