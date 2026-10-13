import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import type { BaseMercado } from "../lib/mercado";
import { produtosKeys } from "./use-produtos-query";

const num = z.coerce.number().catch(0);

const ingredienteSchema = z.object({
  id: z.string(), name: z.string(), unit: z.string().nullable().catch("un").transform((u) => u ?? "un"),
  stock_quantity: num, cost_per_unit: num,
});
const receitaSchema = z.object({ product_id: z.string(), ingredient_id: z.string(), quantity: num });
const produtoSchema = z.object({
  id: z.string(), name: z.string(), emoji: z.string().nullable().catch(null), cost: num, stock_quantity: num,
  recipe_mode: z.string().nullable().catch(null), batch_yield: num,
  origem: z.enum(["compra", "faz"]).nullable().catch(null),
});

/** Tudo que o "Tô no mercado" precisa: ingredientes, receitas e produtos ativos. */
export function useMercadoQuery(userId: string | undefined) {
  return useQuery({
    queryKey: produtosKeys.list({ tela: "mercado", userId }),
    enabled: !!userId,
    // o estoque muda o tempo todo (Foco, outras compras): busca de novo ao abrir
    refetchOnMount: "always",
    queryFn: async (): Promise<BaseMercado> => {
      const uid = userId ?? "";
      const [ings, recs, prods] = await Promise.all([
        supabase.from("ingredients").select("id, name, unit, stock_quantity, cost_per_unit").eq("user_id", uid).order("name"),
        supabase.from("product_recipes").select("product_id, ingredient_id, quantity").eq("user_id", uid),
        supabase.from("products").select("id, name, emoji, cost, stock_quantity, recipe_mode, batch_yield, origem")
          .eq("user_id", uid).eq("is_active", true).order("name"),
      ]);
      if (ings.error) throw ings.error;
      if (recs.error) throw recs.error;
      if (prods.error) throw prods.error;
      const produtos = z.array(produtoSchema).parse(prods.data ?? []);
      const ativos = new Set(produtos.map((p) => p.id));
      return {
        ingredientes: z.array(ingredienteSchema).parse(ings.data ?? []),
        receitas: z.array(receitaSchema).parse(recs.data ?? []).filter((r) => ativos.has(r.product_id)),
        produtos,
      };
    },
  });
}
