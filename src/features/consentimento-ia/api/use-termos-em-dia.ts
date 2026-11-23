import { useQuery } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";
import { TERMOS_VERSAO } from "@/shared/lib/termos";

export const termosKeys = createQueryKeys("termos-aceitos");

/** true when the vendor already accepted the current Terms (so the combined screen will not show). */
export function useTermosEmDia(userId: string | undefined) {
  return useQuery({
    queryKey: termosKeys.byUser(userId ?? ""),
    enabled: !!userId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from("profiles").select("termos_aceitos_versao").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return (data as { termos_aceitos_versao?: string | null } | null)?.termos_aceitos_versao === TERMOS_VERSAO;
    },
  });
}
