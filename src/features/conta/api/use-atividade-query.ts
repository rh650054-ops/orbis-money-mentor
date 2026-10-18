import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { resumirAtividade, type BlocoFoco } from "../lib/atividade";
import { contaKeys } from "./use-conta-query";

/** Last 30 days of Foco blocks → sales, approaches, active days. */
export function useAtividadeQuery(userId: string | undefined) {
  return useQuery({
    queryKey: [...contaKeys.byUser(userId ?? ""), "atividade"],
    enabled: !!userId,
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("challenge_blocks")
        .select("started_at, created_at, sales_count, approaches_count, sold_amount")
        .eq("user_id", userId!)
        .gte("created_at", desde)
        .limit(2000);
      if (error) throw error;
      return resumirAtividade((data ?? []) as BlocoFoco[]);
    },
  });
}
