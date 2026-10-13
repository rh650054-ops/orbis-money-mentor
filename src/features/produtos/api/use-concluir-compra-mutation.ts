import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
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
export interface ConcluirCompra { itens: ItemCompraRpc[]; porItem: boolean; total: number | null }

// mercado_concluir ainda não está nos tipos gerados do Supabase
interface RpcCliente {
  rpc: (fn: "mercado_concluir", args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
}

/** Conclui o "Tô no mercado": tudo numa transação só no banco (mercado_concluir). */
export function useConcluirCompraMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: ConcluirCompra): Promise<ResultadoCompra> => {
      const { data, error } = await (supabase as unknown as RpcCliente).rpc("mercado_concluir", {
        p_itens: c.itens, p_total: c.porItem ? null : c.total, p_por_item: c.porItem,
      });
      if (error) throw error;
      return resultadoCompraSchema.parse(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}
