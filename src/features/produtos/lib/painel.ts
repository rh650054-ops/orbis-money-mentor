/* Produtos e Estoque (24/11/2026): what the panel says about each product, from the same data and the
   same rules the production screen uses (lib/producao.ts). Pure. Nothing here is estimated: a cost that
   depends on an incomplete recipe is "parcial", and "pode produzir" only counts what the stock covers. */
import type { CatalogoProducao } from "./producao";
import { linhasDoItem, situacaoDoItem } from "./producao";

export type SituacaoReceita = "completa" | "incompleta" | "sem_receita" | "revenda";
export interface PainelDoProduto {
  receita: SituacaoReceita;
  /** the cost per unit can be shown as exact (resale cost typed, or a complete recipe) */
  custoConfiavel: boolean;
  /** at least one product line (or flavour) has every ingredient of one batch in stock */
  podeProduzir: boolean;
  sabores: string[];
}

export function painelDoProduto(c: CatalogoProducao | undefined, p: { id: string; origem: string | null; cost: number }): PainelDoProduto {
  const sabores = c ? c.sabores.filter((s) => s.product_id === p.id) : [];
  const nomes = sabores.map((s) => s.name);
  if (p.origem === "compra") return { receita: "revenda", custoConfiavel: p.cost > 0, podeProduzir: false, sabores: nomes };
  const prod = c?.produtos.find((x) => x.id === p.id);
  const temReceita = !!c && c.receitas.some((r) => r.product_id === p.id);
  if (!c || !prod || !temReceita) {
    // no recipe: the cost is the one he typed ("gasto uns R$ 48 e sai umas 30"), shown as his number
    return { receita: "sem_receita", custoConfiavel: p.cost > 0, podeProduzir: false, sabores: nomes };
  }
  const linhas = sabores.length > 0 ? sabores : [null];
  const situacoes = linhas.map((s) => situacaoDoItem(c, prod, s));
  const completa = situacoes.every((s) => s === "pronta");
  const estoque = new Map(c.ingredientes.map((i) => [i.id, i.stock_quantity]));
  const porUnidade = prod.recipe_mode === "per_unit";
  const podeProduzir = !porUnidade && linhas.some((s, i) => situacoes[i] === "pronta"
    && linhasDoItem(c, prod, s).filter((r) => r.quantity > 0).every((r) => (estoque.get(r.ingredient_id) ?? 0) >= r.quantity));
  return { receita: completa ? "completa" : "incompleta", custoConfiavel: completa && p.cost > 0, podeProduzir, sabores: nomes };
}

export type SituacaoEstoque = "ok" | "baixo" | "sem" | "sem_controle";
export function situacaoDoEstoque(p: { controla_estoque?: boolean | null; stock_quantity: number; stock_min?: number | null }): SituacaoEstoque {
  if (p.controla_estoque === false) return "sem_controle";
  if (p.stock_quantity <= 0) return "sem";
  return p.stock_quantity <= Math.max(3, p.stock_min || 0) ? "baixo" : "ok";
}

/** The three numbers at the top. Units are finished products only (never ingredients); "pode produzir"
 *  counts PRODUCTS, never the sum of flavours that share the same ingredients. */
export function resumoDoPainel(lista: { stock_quantity: number; controla_estoque?: boolean | null }[], painel: PainelDoProduto[]) {
  return {
    produtos: lista.length,
    unidades: lista.reduce((s, p) => s + (p.controla_estoque === false ? 0 : Math.max(0, p.stock_quantity)), 0),
    podeProduzir: painel.filter((x) => x.podeProduzir).length,
  };
}
