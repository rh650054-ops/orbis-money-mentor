/* SOBRAR · no bolso (Rick, 29/10/2026): what the month left in the pocket so far, with the
   same cost/calote reading the profit mission uses, plus the active mission's progress. */
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { objetivoLucroKeys } from "./use-objetivo-lucro";

const num = z.coerce.number().catch(0);
const sobrarSchema = z.object({
  hoje: z.string(),
  vendas_mes: num, unidades_mes: num, dias_mes: num,
  lucro_unid: num, lucro_mes: num, ticket: num,
  /** 'sem_custo' = no product cost known → the pocket number is a guess, show "?" */
  fonte_custo: z.enum(["extrato", "receita", "sem_custo"]).catch("sem_custo"),
  produto_nome: z.string().nullable().catch(null),
  custo_corre_dia: num, calote_pct: num, calote_unid: num,
  missao: z.object({ alvo: num, lucro: num, dia: num, dias: num }).nullable().catch(null),
});
export type SobrarMes = z.infer<typeof sobrarSchema>;

export function useSobrarMesQuery(userId: string | undefined) {
  return useQuery({
    queryKey: [...objetivoLucroKeys.byUser(userId ?? ""), "sobrar-mes"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<SobrarMes | null> => {
      const { data, error } = await supabase.rpc("vant_sobrar_mes" as never);
      if (error) throw error;
      if (!data) return null;
      const r = sobrarSchema.safeParse(data);
      return r.success ? r.data : null;
    },
  });
}
