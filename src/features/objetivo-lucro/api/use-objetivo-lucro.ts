/* Profit challenge: AI analysis of the last 60 days, active challenge, create and delete. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";
import { baseSchema, desafioSchema, iaSchema, type BaseLucro, type Desafio, type PlanoIa } from "../types";

export const objetivoLucroKeys = createQueryKeys("objetivo-lucro");

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

export interface AnaliseIa { base: BaseLucro; ia: PlanoIa | null; limite: boolean; diasTrabalho: number | null }

/** Calls the AI with the seller's 60 days. `diasTrabalho` omitted = his usual rhythm.
    If the AI is down we still get `base` to plan locally. */
export function useAnalisarComIaMutation() {
  return useMutation({
    mutationFn: async (v: { alvo: number; dias: number; diasTrabalho?: number }): Promise<AnaliseIa> => {
      const { data, error } = await supabase.functions.invoke("objetivo-lucro-ia", { body: v });
      const corpo = (data ?? {}) as { ia?: unknown; base?: unknown; limite?: boolean; dias_trabalho?: number };
      if (corpo.base) {
        return { base: baseSchema.parse(corpo.base), ia: corpo.ia ? iaSchema.parse(corpo.ia) : null, limite: false, diasTrabalho: corpo.dias_trabalho ?? null };
      }
      // Function failed before reading the data (limit, auth, outage): read the base straight from the DB.
      const { data: b, error: e2 } = await rpc("objetivo_lucro_analise");
      if (e2 || !b) throw error ?? e2 ?? new Error("sem dados");
      return { base: baseSchema.parse(b), ia: null, limite: Boolean(corpo.limite), diasTrabalho: null };
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
    mutationFn: async (v: { alvo: number; dias: number; diasTrabalho: number; ia: PlanoIa | null }) => {
      const { error } = await rpc("objetivo_lucro_criar", { p_alvo: v.alvo, p_dias: v.dias, p_dias_trabalho: v.diasTrabalho, p_ia: v.ia });
      if (error) throw error;
    },
    // 28/10: the mission sets the Foco's daily goal (server) — refresh it too
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: objetivoLucroKeys.all }), qc.invalidateQueries({ queryKey: ["meta-do-dia"] })]),
  });
}

export function useExcluirDesafioMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rpc("objetivo_lucro_excluir", { p_id: id });
      if (error) throw error;
    },
    // 28/10: the mission sets the Foco's daily goal (server) — refresh it too
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: objetivoLucroKeys.all }), qc.invalidateQueries({ queryKey: ["meta-do-dia"] })]),
  });
}
