/* New production flow: register, correct, undo. Each call carries a key made BEFORE sending and
   reused on retries, so a lost answer never records twice (the database returns the stored result). */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";
import { respostaSchema, type ItemEnvio } from "./use-producao-query";

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: produtosKeys.all });
}

export function useRegistrarProducaoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { chave: string; itens: ItemEnvio[]; justificativa: string | null }) => {
      const { data, error } = await rpc("producao_registrar", { p_chave: v.chave, p_itens: v.itens, p_justificativa: v.justificativa });
      if (error) throw error;
      return respostaSchema.parse(data);
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useCorrigirProducaoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { registro: string; chave: string; itens: ItemEnvio[]; motivo: string }) => {
      const { data, error } = await rpc("producao_corrigir", { p_registro: v.registro, p_chave: v.chave, p_itens: v.itens, p_motivo: v.motivo });
      if (error) throw error;
      return respostaSchema.parse(data);
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useDesfazerProducaoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { registro: string; chave: string; motivo: string }) => {
      const { data, error } = await rpc("producao_desfazer", { p_registro: v.registro, p_chave: v.chave, p_motivo: v.motivo });
      if (error) throw error;
      return respostaSchema.parse(data);
    },
    onSuccess: () => invalidar(qc),
  });
}
