/* The consolidated balance for any Finanças tab: financas_home() (already loaded by the page) +
   the connections the Vender screen already reads (useBancosQuery, same cache). No new query to
   the bank, no new data stored. If the connections cannot be read, no balance counts as recent. */
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import { useBancosQuery } from "@/features/vender";
import { consolidar, type Consolidado } from "../lib/saldo";

export function useSaldoDisponivel(h: HomeFinancas | null, userId: string | undefined): Consolidado | null {
  const q = useBancosQuery(userId);
  if (!h) return null;
  return consolidar(h, q.data?.bancos ?? (q.isError ? [] : null));
}
