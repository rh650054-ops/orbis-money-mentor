import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createQueryKeys, supabase } from "@/shared/api";
import { definirConsentimentoIa } from "@/shared/lib/consentimento-ia";

export const consentimentoIaKeys = createQueryKeys("consentimento-ia");

// The table is newer than the generated types: typed here with zod instead.
const linhaSchema = z.object({ permitido: z.boolean() }).nullable();
type Tabela = {
  select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } };
  upsert: (v: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
};
const tabela = () => (supabase.from as unknown as (t: string) => Tabela)("consentimento_ia");

/** null = not answered yet. Also feeds the fetch gate (consentimento-ia.ts). */
export function useConsentimentoIa(userId: string | undefined) {
  const q = useQuery({
    queryKey: consentimentoIaKeys.byUser(userId ?? ""),
    enabled: !!userId,
    queryFn: async (): Promise<boolean | null> => {
      const { data, error } = await tabela().select("permitido").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return linhaSchema.parse(data)?.permitido ?? null;
    },
  });
  useEffect(() => { definirConsentimentoIa(q.data === true); }, [q.data]);
  return q;
}

export function useResponderConsentimentoIa(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (permitido: boolean) => {
      if (!userId) throw new Error("sem usuário");
      const { error } = await tabela().upsert({ user_id: userId, permitido, respondido_em: new Date().toISOString() });
      if (error) throw error;
      return permitido;
    },
    onSuccess: (permitido) => {
      definirConsentimentoIa(permitido);
      void qc.invalidateQueries({ queryKey: consentimentoIaKeys.byUser(userId ?? "") });
    },
  });
}
