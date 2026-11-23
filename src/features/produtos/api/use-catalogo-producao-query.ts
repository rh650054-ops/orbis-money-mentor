/* Everything the production screen needs, read once: products, flavours (with their own yield and
   whether they take the base), every recipe row and the ingredient stock. */
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import type { CatalogoProducao } from "../lib/producao";
import { produtosKeys } from "./use-produtos-query";

const num = z.coerce.number().catch(0);
const produto = z.object({
  id: z.string(), name: z.string(), emoji: z.string().nullable().catch(null), recipe_mode: z.string().nullable().catch(null),
  batch_yield: num, origem: z.enum(["compra", "faz"]).nullable().catch(null), stock_quantity: num,
});
const sabor = z.object({
  id: z.string(), product_id: z.string(), name: z.string(), emoji: z.string().catch("🥤"), stock_quantity: num,
  batch_yield: z.coerce.number().nullable().catch(null), usa_base: z.boolean().catch(true),
});
const linha = z.object({ product_id: z.string(), variant_id: z.string().nullable().catch(null), ingredient_id: z.string(), quantity: num, aprender: z.boolean().catch(false) });
const ingrediente = z.object({ id: z.string(), name: z.string(), unit: z.string().nullable().catch("un").transform((u) => u ?? "un"), stock_quantity: num });

type Linhas = PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>;

/** Before the yield-per-flavour migration the two new columns do not exist: read without them. */
async function saboresDe(uid: string) {
  // product_variants is not in the generated Supabase types yet
  type Tabela = { select: (c: string) => { eq: (c: string, v: string) => { order: (c: string) => Linhas } } };
  const de = (cols: string) => (supabase as unknown as { from: (t: string) => Tabela }).from("product_variants").select(cols).eq("user_id", uid).order("posicao");
  const r = await de("id, product_id, name, emoji, stock_quantity, batch_yield, usa_base");
  if (!r.error) return r.data ?? [];
  const velho = await de("id, product_id, name, emoji, stock_quantity");
  if (velho.error) throw velho.error;
  return velho.data ?? [];
}

export function useCatalogoProducaoQuery(userId: string | undefined) {
  return useQuery({
    queryKey: produtosKeys.list({ tela: "producao", userId }),
    enabled: !!userId,
    refetchOnMount: "always",
    queryFn: async (): Promise<CatalogoProducao> => {
      const uid = userId ?? "";
      const [prods, sabs, recs, ings] = await Promise.all([
        supabase.from("products").select("id, name, emoji, recipe_mode, batch_yield, origem, stock_quantity").eq("user_id", uid).eq("is_active", true).order("name"),
        saboresDe(uid),
        supabase.from("product_recipes").select("product_id, variant_id, ingredient_id, quantity, aprender").eq("user_id", uid),
        supabase.from("ingredients").select("id, name, unit, stock_quantity").eq("user_id", uid).order("name"),
      ]);
      if (prods.error) throw prods.error;
      if (recs.error) throw recs.error;
      if (ings.error) throw ings.error;
      return {
        produtos: z.array(produto).parse(prods.data ?? []),
        sabores: z.array(sabor).parse(sabs),
        receitas: z.array(linha).parse(recs.data ?? []),
        ingredientes: z.array(ingrediente).parse(ings.data ?? []),
      };
    },
  });
}
