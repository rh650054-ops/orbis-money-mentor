/* "Quantas unidades vai fazer com essa compra?" e "Produzi" (Rick, 19/10). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";

const num = z.coerce.number().catch(0);
type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

const aProduzirSchema = z.object({ produto_id: z.string(), compra_id: z.string(), previstas: num, produzidas: num, custo: num });
export function useAProduzirQuery(enabled: boolean) {
  return useQuery({
    queryKey: produtosKeys.list({ tela: "a-produzir" }),
    enabled,
    queryFn: async () => {
      const { data, error } = await rpc("produto_a_produzir");
      if (error) return []; // banco sem a função ainda: só não mostra
      return z.array(aProduzirSchema).parse(data ?? []);
    },
  });
}

export function useRendimentoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { compra: string; produto: string; unidades: number }) => {
      const { data, error } = await rpc("mercado_rendimento", { p_compra: v.compra, p_produto: v.produto, p_unidades: v.unidades });
      if (error) throw error;
      return z.object({ custo: z.coerce.number().nullable().catch(null) }).parse(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}

export function useProduzirMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { produto: string; unidades: number }) => {
      const { data, error } = await rpc("produto_produzir", { p_produto: v.produto, p_unidades: v.unidades });
      if (error) throw error;
      return z.object({ estoque: num, restante: z.coerce.number().nullable().catch(null) }).parse(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}
