import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";
import { unidadeDe, type Unidade } from "../types";

const num = z.coerce.number().catch(0);
const linhaSchema = z.object({ ingredient_id: z.string(), quantity: num });
const ingSchema = z.object({
  id: z.string(), name: z.string(), cost_per_unit: num, stock_quantity: num,
  unit: z.string().nullable().catch("un"), pacote_qtd: z.coerce.number().catch(1),
});

export interface IngredienteDaReceita {
  id: string; nome: string; qtd: number; preco: number; estoque: number; unidade: Unidade; pacote: number;
}

/** A receita salva do produto, com o custo e o estoque atual de cada ingrediente. */
export function useReceitaQuery(produtoId: string | undefined) {
  return useQuery({
    queryKey: produtosKeys.detail(`${produtoId ?? ""}:receita`),
    enabled: !!produtoId,
    refetchOnMount: "always",
    queryFn: async (): Promise<IngredienteDaReceita[]> => {
      const rec = await supabase.from("product_recipes").select("ingredient_id, quantity").eq("product_id", produtoId!);
      if (rec.error) throw rec.error;
      const linhas = z.array(linhaSchema).parse(rec.data ?? []);
      if (linhas.length === 0) return [];
      const ing = await supabase.from("ingredients").select("id, name, cost_per_unit, stock_quantity, unit, pacote_qtd")
        .in("id", linhas.map((l) => l.ingredient_id));
      if (ing.error) throw ing.error;
      const porId = new Map(z.array(ingSchema).parse(ing.data ?? []).map((i) => [i.id, i]));
      return linhas.flatMap((l) => {
        const i = porId.get(l.ingredient_id);
        return i ? [{
          id: i.id, nome: i.name, qtd: l.quantity, preco: i.cost_per_unit, estoque: i.stock_quantity,
          unidade: unidadeDe(i.unit), pacote: i.pacote_qtd > 0 ? i.pacote_qtd : 1,
        }] : [];
      });
    },
  });
}
