import { useQuery } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";
import { faixaSchema, produtoSchema, type ProdutoComFaixas } from "../types";

export const produtosKeys = createQueryKeys("produtos");

const CAMPOS =
  "id, name, photo_url, cost, sale_price, stock_quantity, stock_min, open_price, recipe_mode, batch_yield, origem, emoji, controla_estoque";

/** Produtos ativos do vendedor, com os combos ("2 por R$ 5"). */
export function useProdutosQuery(userId: string | undefined, opts?: { sempreFresco?: boolean }) {
  return useQuery({
    queryKey: produtosKeys.byUser(userId ?? ""),
    enabled: !!userId,
    // edição: busca de novo ao abrir (o Foco e as compras mudam estoque e custo)
    ...(opts?.sempreFresco ? { refetchOnMount: "always" as const } : {}),
    queryFn: async (): Promise<ProdutoComFaixas[]> => {
      const [prods, faixas] = await Promise.all([
        supabase.from("products").select(CAMPOS).eq("user_id", userId!).eq("is_active", true).order("name"),
        supabase.from("product_price_tiers").select("product_id, qty, price").eq("user_id", userId!).order("qty"),
      ]);
      if (prods.error) throw prods.error;
      if (faixas.error) throw faixas.error;
      const fx = (faixas.data ?? []).map((f) => faixaSchema.parse(f));
      return (prods.data ?? []).map((p) => {
        const prod = produtoSchema.parse(p);
        return { ...prod, faixas: fx.filter((f) => f.product_id === prod.id).map(({ qty, price }) => ({ qty, price })) };
      });
    },
  });
}
