/* "Ajustar estoque" of an ingredient (25/11): a physical count with a reason, through the database
   function ingrediente_ajustar_estoque (locks the row, keeps history). Never a direct update. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
type Tab = { from: (t: string) => { select: (c: string) => { limit: (n: number) => PromiseLike<{ error: unknown }> } } };

/** Until the migration is applied the button is not offered (nothing would record the history). */
export function useAjusteDisponivel() {
  return useQuery({
    queryKey: produtosKeys.detail("ajuste-estoque-disponivel"),
    staleTime: 10 * 60_000,
    queryFn: async () => !(await (supabase as unknown as Tab).from("estoque_ajustes").select("id").limit(1)).error,
  });
}

export function useAjustarEstoqueMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { ingrediente: string; contado: number; motivo: string }) => {
      const { error } = await (supabase.rpc as unknown as Rpc)("ingrediente_ajustar_estoque", { p_ingrediente: v.ingrediente, p_contado: v.contado, p_motivo: v.motivo });
      if (error) throw new Error(error.message ?? "não consegui ajustar");
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: produtosKeys.all }); },
  });
}
