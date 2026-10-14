import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { createQueryKeys, supabase } from "@/shared/api";
import { useAuth } from "@/hooks/useAuth";

export const x1Keys = createQueryKeys("x1");

const schema = z.object({ balance: z.coerce.number().catch(0) }).nullable();

/** Saldo antigo da carteira do X1 (só leitura). A carteira fechou em 14/10/2026:
 *  quem tinha saldo resolve com o suporte; o app não deposita nem saca mais. */
export function useSaldoAntigoQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: x1Keys.detail(`saldo-antigo:${user?.id ?? ""}`),
    enabled: !!user?.id,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.from("x1_wallets" as never).select("balance").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return schema.parse(data ?? null)?.balance ?? 0;
    },
  });
}
