import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { createQueryKeys, supabase } from "@/shared/api";
import { definirConsentimentoIa, VERSAO_DIVULGACAO_IA } from "@/shared/lib/consentimento-ia";

export const consentimentoIaKeys = createQueryKeys("consentimento-ia");

// The table is newer than the generated types: typed here with zod instead.
const linhaSchema = z.object({ permitido: z.boolean(), versao: z.string().nullable().optional() }).nullable();
type Tabela = {
  select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } };
};
type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
const tabela = () => (supabase as unknown as { from: (t: string) => Tabela }).from("consentimento_ia");

/** null = not answered on the CURRENT disclosure (no answer, or an answer to an older text).
 *  Also feeds the fetch gate (consentimento-ia.ts). */
export function useConsentimentoIa(userId: string | undefined) {
  const q = useQuery({
    queryKey: consentimentoIaKeys.byUser(userId ?? ""),
    enabled: !!userId,
    queryFn: async (): Promise<boolean | null> => {
      const { data, error } = await tabela().select("permitido, versao").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      const linha = linhaSchema.parse(data);
      if (!linha || linha.versao !== VERSAO_DIVULGACAO_IA) return null;
      return linha.permitido;
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
      // granting only through the RPC, which records the disclosure version (and the history)
      const { error } = await (supabase as unknown as { rpc: Rpc }).rpc("responder_consentimento_ia", { p_permitido: permitido, p_versao: VERSAO_DIVULGACAO_IA });
      if (error) throw error;
      return permitido;
    },
    onSuccess: (permitido) => {
      definirConsentimentoIa(permitido);
      void qc.invalidateQueries({ queryKey: consentimentoIaKeys.byUser(userId ?? "") });
    },
  });
}
