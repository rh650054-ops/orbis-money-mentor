import { useQuery } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";

/* /assinar?t=<token>: who is subscribing, read without a session (token = 30 min). */
export const assinarKeys = createQueryKeys("assinar");

export type QuemAssina = { nome: string | null; email: string | null; telefone: string | null; user_id: string; plano_atual: "pro" | "essencial" | null };

export function useQuemAssinaQuery(token: string | null) {
  return useQuery({
    queryKey: assinarKeys.list({ token }),
    enabled: !!token,
    retry: 0,
    queryFn: async (): Promise<QuemAssina | null> => {
      const { data, error } = await supabase.rpc("assinar_token_ler" as never, { p_token: token } as never);
      if (error) throw error;
      const r = ((data as unknown as QuemAssina[] | null) ?? [])[0];
      return r ?? null;
    },
  });
}
