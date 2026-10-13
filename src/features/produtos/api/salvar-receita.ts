import { supabase } from "@/shared/api";
import type { ItemReceita } from "../types";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;

/** Grava a receita do produto (ingredientes + quanto rende) numa transação só no banco.
 *  Lista vazia = apaga a receita (o produto deixa de ser "por leva"). */
export async function salvarReceita(produtoId: string, receita: ItemReceita[], rende: number): Promise<void> {
  const { error } = await (supabase.rpc as unknown as Rpc)("produto_salvar_receita", {
    p_produto: produtoId,
    p_itens: receita.map((i) => ({ ...(i.id ? { id: i.id } : {}), nome: i.nome, qtd: i.qtd, preco: i.preco > 0 ? i.preco : 0 })),
    p_rende: Math.max(1, Math.round(rende)),
  });
  if (error) throw error;
}
