/* "Gerenciar classificação": each bank of the Raio-X is work or personal. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { raioxKeys } from "./keys";

type Rpc = (f: string, a?: object) => PromiseLike<{ error: { message: string } | null }>;

export function useContaUsoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ banco, uso }: { banco: string; uso: "vendas" | "pessoal" }) => {
      const { error } = await (supabase.rpc as unknown as Rpc)("extrato_conta_uso", { p_banco: banco, p_uso: uso });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: raioxKeys.all }),
  });
}
