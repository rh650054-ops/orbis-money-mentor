import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";

/** 25/11: is the per-unit migration applied? Until then the editor works per recipe only, exactly as
 *  before (sending a per-unit amount to the old database would save it as per batch). */
export function useReceitaPorUnidadeDisponivel() {
  return useQuery({
    queryKey: produtosKeys.detail("receita-por-unidade-disponivel"),
    staleTime: 10 * 60_000,
    queryFn: async () => !(await supabase.from("product_recipes").select("base").limit(1)).error,
  });
}
