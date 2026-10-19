/* "Outros" com nome: cria um tópico só do vendedor (com teto opcional pra ter barra). */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { analiseKeys } from "./use-analise";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export function useCriarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, teto }: { nome: string; teto: number | null }) => {
      const { data, error } = await (supabase as unknown as { rpc: Rpc }).rpc("extrato_categoria_criar", { p_nome: nome, p_teto: teto });
      if (error) throw new Error(error.message);
      return data as { slug: string; rotulo: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: analiseKeys.all }),
  });
}

/** Mensagem curta pro erro do servidor. */
export const erroCategoria = (e: unknown) =>
  /limite/.test(String((e as Error)?.message)) ? "Você chegou no limite de 30 tópicos." : "Não consegui criar. Tenta de novo.";
