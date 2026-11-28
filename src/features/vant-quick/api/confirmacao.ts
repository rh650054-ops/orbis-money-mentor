import { useQuery } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";

export const quickKeys = createQueryKeys("vant-quick");

/** Which of these widget sales are already in the database (RLS: only the signed-in account's own
    rows). "Confirmada" on the widget means exactly this; until then it says "salva, sincronizando".
    Asked every 5 s while some are waiting, and never while none is. */
export function useConfirmacaoVendas(conta: string | null, ids: string[]) {
  return useQuery({
    queryKey: quickKeys.list({ conta, ids: [...ids].sort() }),
    enabled: !!conta && ids.length > 0,
    refetchInterval: 5_000,
    retry: 1,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("defcon_sales").select("id").in("id", ids);
      if (error) throw error;
      return (data ?? []).map((r: { id: string }) => r.id);
    },
  });
}
