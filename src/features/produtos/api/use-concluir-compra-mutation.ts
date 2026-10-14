import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import type { NovaReceita } from "../lib/mercado-produto";
import { produtosKeys } from "./use-produtos-query";

const num = z.coerce.number().catch(0);

export const resultadoCompraSchema = z.object({
  compra_id: z.string(),
  total: num,
  produtos: z.array(z.object({
    id: z.string(), nome: z.string(), receitas: num, unidades: num, custo_antes: num, custo_depois: num,
  })).catch([]),
});
export type ResultadoCompra = z.infer<typeof resultadoCompraSchema>;

export interface ItemCompraRpc {
  tipo: "ingrediente" | "produto" | "novo";
  id: string | null;
  nome: string;
  qtd: number;
  preco_unit: number | null;
  para: string[];
}
export interface ConcluirCompra { itens: ItemCompraRpc[]; porItem: boolean; total: number | null; novaReceita?: NovaReceita | null }

// mercado_concluir ainda não está nos tipos gerados do Supabase
interface RpcCliente {
  rpc: (fn: "mercado_concluir" | "produto_salvar_receita", args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
}

/** 1ª compra de um produto sem receita: grava a receita ANTES, e a compra entra com os
 *  ingredientes já ligados ao produto — assim ela vira estoque do produto na hora. */
async function comReceitaNova(c: ConcluirCompra, rpc: RpcCliente["rpc"]): Promise<ItemCompraRpc[]> {
  const r = c.novaReceita;
  if (!r) return c.itens;
  const salvo = await rpc("produto_salvar_receita", {
    p_produto: r.produto, p_rende: r.rende,
    p_itens: r.itens.map((i) => ({ ...(i.id ? { id: i.id } : {}), nome: i.nome, qtd: i.qtd, preco: i.preco > 0 ? i.preco : 0 })),
  });
  if (salvo.error) throw salvo.error;
  const { data, error } = await supabase.from("ingredients").select("id, name");
  if (error) throw error;
  const porNome = new Map((data ?? []).map((i) => [i.name.trim().toLowerCase(), i.id]));
  return c.itens.map((it) => {
    const id = it.id ?? porNome.get(it.nome.trim().toLowerCase()) ?? null;
    return it.tipo === "produto" || !id ? it : { ...it, tipo: "ingrediente" as const, id, para: [r.produto] };
  });
}

/** Conclui o "Tô no mercado": tudo numa transação só no banco (mercado_concluir). */
export function useConcluirCompraMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: ConcluirCompra): Promise<ResultadoCompra> => {
      const rpc = (supabase as unknown as RpcCliente).rpc.bind(supabase);
      const itens = await comReceitaNova(c, rpc);
      const { data, error } = await rpc("mercado_concluir", {
        p_itens: itens, p_total: c.porItem ? null : c.total, p_por_item: c.porItem,
      });
      if (error) throw error;
      return resultadoCompraSchema.parse(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}
