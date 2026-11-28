/* Cards, savings and debts of the bank (financas_painel), read through React Query. */
import { useQuery } from "@tanstack/react-query";
import { createQueryKeys } from "@/shared/api";
import { carregarPainel } from "@/components/financas/FinancasPainel";

export const financasBancosKeys = createQueryKeys("financas-bancos");

export function usePainelQuery(userId: string | undefined) {
  return useQuery({
    queryKey: [...financasBancosKeys.all, "painel", userId ?? ""] as const,
    enabled: !!userId,
    queryFn: carregarPainel,
  });
}
