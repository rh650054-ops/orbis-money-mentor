import { supabase } from "@/shared/api";
import type { ItemReceita } from "../types";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

/** The price sent for one ingredient: only when he typed it here, at full precision; otherwise 0
 *  (= keep the stored one). A NEW ingredient without a typed price is created with cost 0, as before. */
export const precoParaGravar = (i: Pick<ItemReceita, "preco" | "precoEditado">) => (i.precoEditado && i.preco > 0 ? i.preco : 0);

/** Grava a receita do produto (ingredientes + quanto rende) numa transação só no banco,
 *  depois a unidade e o tamanho da compra de cada ingrediente.
 *  Lista vazia = apaga a receita (o produto deixa de ser "por leva"). */
export async function salvarReceita(produtoId: string, receita: ItemReceita[], rende: number): Promise<void> {
  const compra = { p_itens: receita.map((i) => ({ nome: i.nome, unidade: i.unidade, pacote: i.pacote })) };
  // 26/10: ANTES da receita, converte o estoque/custo de quem saiu de "un" pra g/ml (pote de 650 g
  // comprado como "1 un" vira 650 g). Depois da receita, roda de novo pros ingredientes novos.
  if (receita.length > 0) {
    const r0 = await (supabase.rpc as unknown as Rpc)("ingredientes_definir_compra", compra);
    if (r0.error) throw r0.error;
  }
  const { error } = await (supabase.rpc as unknown as Rpc)("produto_salvar_receita", {
    p_produto: produtoId,
    // 23/11: preco 0 = "keep the price you have" (the RPC only updates cost_per_unit when preco > 0).
    // An untouched price is not re-sent, so saving the recipe never overwrites a newer Market price.
    p_itens: receita.map((i) => ({ ...(i.id ? { id: i.id } : {}), nome: i.nome, qtd: i.qtd, preco: precoParaGravar(i), ...(i.aprender ? { aprender: true } : {}) })),
    p_rende: Math.max(1, Math.round(rende)),
  });
  if (error) throw error;
  // como cada ingrediente é comprado (unidade de medida e tamanho do pacote)
  if (receita.length > 0) {
    const r = await (supabase.rpc as unknown as Rpc)("ingredientes_definir_compra", compra);
    if (r.error) throw r.error;
  }
}
