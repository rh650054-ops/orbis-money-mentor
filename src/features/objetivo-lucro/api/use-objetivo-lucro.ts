/* Profit challenge: last-60-days analysis, active challenge, create and delete. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";
import { baseSchema, desafioSchema, type BaseLucro, type Desafio } from "../types";

export const objetivoLucroKeys = createQueryKeys("objetivo-lucro");

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

export function useAnaliseLucroQuery(ativo: boolean) {
  return useQuery({
    queryKey: objetivoLucroKeys.detail("analise"),
    enabled: ativo,
    queryFn: async (): Promise<BaseLucro | null> => {
      const { data, error } = await rpc("objetivo_lucro_analise");
      if (error) throw error;
      return data ? baseSchema.parse(data) : null;
    },
  });
}

export function useDesafioAtualQuery() {
  return useQuery({
    queryKey: objetivoLucroKeys.detail("atual"),
    queryFn: async (): Promise<Desafio | null> => {
      const { data, error } = await rpc("objetivo_lucro_atual");
      if (error) throw error;
      return data ? desafioSchema.parse(data) : null;
    },
  });
}

export function useCriarDesafioMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { alvo: number; dias: number; diasTrabalho: number }) => {
      const { error } = await rpc("objetivo_lucro_criar", { p_alvo: v.alvo, p_dias: v.dias, p_dias_trabalho: v.diasTrabalho });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: objetivoLucroKeys.all }),
  });
}

export function useExcluirDesafioMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rpc("objetivo_lucro_excluir", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: objetivoLucroKeys.all }),
  });
}
