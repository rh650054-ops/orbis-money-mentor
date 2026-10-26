import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";
import type { ItemReceitaEstoque } from "../lib/sobra";

const num = z.coerce.number().catch(0);
const receitaSchema = z.object({ product_id: z.string(), ingredient_id: z.string(), quantity: num });
const ingSchema = z.object({ id: z.string(), name: z.string(), unit: z.string().nullable().catch("un"), stock_quantity: num, pacote_qtd: num });

/** Depois da compra: receita de cada produto + o estoque atual de cada ingrediente. */
export function useSobraEstoqueQuery(produtos: string[], compraId: string) {
  return useQuery({
    queryKey: produtosKeys.list({ tela: "sobra-estoque", compraId, produtos }),
    enabled: produtos.length > 0,
    queryFn: async (): Promise<Record<string, ItemReceitaEstoque[]>> => {
      const { data: rec, error } = await supabase.from("product_recipes").select("product_id, ingredient_id, quantity").in("product_id", produtos).is("variant_id", null);
      if (error) throw error;
      const receitas = z.array(receitaSchema).parse(rec ?? []);
      const ids = [...new Set(receitas.map((r) => r.ingredient_id))];
      if (ids.length === 0) return {};
      const { data: ing, error: e2 } = await supabase.from("ingredients").select("id, name, unit, stock_quantity, pacote_qtd").in("id", ids);
      if (e2) throw e2;
      const porId = new Map(z.array(ingSchema).parse(ing ?? []).map((i) => [i.id, i]));
      const out: Record<string, ItemReceitaEstoque[]> = {};
      for (const r of receitas) {
        const i = porId.get(r.ingredient_id);
        if (!i) continue;
        (out[r.product_id] ??= []).push({ nome: i.name, unidade: i.unit ?? "un", pacote: i.pacote_qtd, porLeva: r.quantity, estoque: i.stock_quantity });
      }
      return out;
    },
  });
}
