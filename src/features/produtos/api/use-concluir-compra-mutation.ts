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
export interface ConcluirCompra {
  itens: ItemCompraRpc[]; porItem: boolean; total: number | null; novaReceita?: NovaReceita | null;
  /** desconto no caixa (já repartido em `itens`); `itensOrig` = como foi digitado, pra editar depois */
  desconto?: number; itensOrig?: ItemCompraRpc[];
  /** id da compra que está sendo editada (desfaz a antiga e grava esta no lugar) */
  editar?: string | null;
}

// mercado_concluir ainda não está nos tipos gerados do Supabase
interface RpcCliente {
  rpc: (fn: "mercado_concluir" | "mercado_salvar" | "produto_salvar_receita", args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
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

/** Função ainda não existe no banco (migração não aplicada). */
export const funcaoFaltando = (e: unknown) => {
  const x = e as { code?: string; message?: string } | null;
  return x?.code === "PGRST202" || /could not find the function/i.test(x?.message ?? "");
};

/** Conclui o "Tô no mercado": tudo numa transação só no banco (mercado_concluir). */
export function useConcluirCompraMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: ConcluirCompra): Promise<ResultadoCompra> => {
      const rpc = (supabase as unknown as RpcCliente).rpc.bind(supabase);
      const itens = await comReceitaNova(c, rpc);
      const base = { p_itens: itens, p_total: c.porItem ? null : c.total, p_por_item: c.porItem };
      let { data, error } = await rpc("mercado_salvar", {
        ...base, p_desconto: c.desconto ?? 0, p_itens_orig: c.itensOrig ?? null, p_editar: c.editar ?? null,
      });
      // banco ainda sem mercado_salvar: compra nova vai pelo caminho antigo (o desconto já está nos preços)
      if (error && !c.editar && funcaoFaltando(error)) ({ data, error } = await rpc("mercado_concluir", base));
      if (error) throw error;
      return resultadoCompraSchema.parse(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}
