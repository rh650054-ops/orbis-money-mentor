import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import type { BaseMercado } from "../lib/mercado";
import { produtosKeys } from "./use-produtos-query";

const num = z.coerce.number().catch(0);

const ingredienteSchema = z.object({
  id: z.string(), name: z.string(), unit: z.string().nullable().catch("un").transform((u) => u ?? "un"),
  stock_quantity: num, cost_per_unit: num, pacote_qtd: z.coerce.number().catch(1),
});
const receitaSchema = z.object({ product_id: z.string(), ingredient_id: z.string(), quantity: num });
const produtoSchema = z.object({
  id: z.string(), name: z.string(), emoji: z.string().nullable().catch(null), cost: num, stock_quantity: num,
  recipe_mode: z.string().nullable().catch(null), batch_yield: num,
  origem: z.enum(["compra", "faz"]).nullable().catch(null), sale_price: num,
});
const ultimoSchema = z.object({ ingredient_id: z.string().nullable(), custo_unitario: num });

/** Tudo que o "Tô no mercado" precisa: ingredientes, receitas, produtos ativos e o
 *  último preço pago por ingrediente (pra dizer se ficou mais caro). */
export function useMercadoQuery(userId: string | undefined) {
  return useQuery({
    queryKey: produtosKeys.list({ tela: "mercado", userId }),
    enabled: !!userId,
    // o estoque muda o tempo todo (Foco, outras compras): busca de novo ao abrir
    refetchOnMount: "always",
    queryFn: async (): Promise<BaseMercado> => {
      const uid = userId ?? "";
      const [ings, recs, prods, ults] = await Promise.all([
        supabase.from("ingredients").select("id, name, unit, stock_quantity, cost_per_unit, pacote_qtd").eq("user_id", uid).order("name"),
        supabase.from("product_recipes").select("product_id, ingredient_id, quantity").eq("user_id", uid),
        supabase.from("products").select("id, name, emoji, cost, stock_quantity, recipe_mode, batch_yield, origem, sale_price")
          .eq("user_id", uid).eq("is_active", true).order("name"),
        supabase.from("compras_mercadoria").select("ingredient_id, custo_unitario").eq("user_id", uid)
          .not("ingredient_id", "is", null).gt("custo_unitario", 0).order("created_at", { ascending: false }).limit(300),
      ]);
      if (ings.error) throw ings.error;
      if (recs.error) throw recs.error;
      if (prods.error) throw prods.error;
      // o mais recente de cada ingrediente (a lista já vem do mais novo pro mais velho)
      const ultimos: Record<string, number> = {};
      if (!ults.error) {
        for (const u of z.array(ultimoSchema).parse(ults.data ?? [])) {
          if (u.ingredient_id && !(u.ingredient_id in ultimos)) ultimos[u.ingredient_id] = u.custo_unitario;
        }
      }
      const produtos = z.array(produtoSchema).parse(prods.data ?? []);
      const ativos = new Set(produtos.map((p) => p.id));
      return {
        ingredientes: z.array(ingredienteSchema).parse(ings.data ?? []),
        receitas: z.array(receitaSchema).parse(recs.data ?? []).filter((r) => ativos.has(r.product_id)),
        produtos,
        ultimos,
      };
    },
  });
}
