import { useQuery } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";

/* Renewal Pix issued by Hotmart for the person's own subscription (23/10/2026).
   Only while it is still payable; when Hotmart issues a new one, the query returns it. */
export const renovacaoKeys = createQueryKeys("renovacao");

export type RenovacaoPix = {
  subscription_id: string; purchase_id: string; plano: string | null; valor: number;
  pix_code: string; pix_qrcode: string | null; vence_em: string; gerado_em: string; atrasada: boolean;
};

const primeira = (data: unknown): RenovacaoPix | null => {
  const r = ((data as RenovacaoPix[] | null) ?? [])[0];
  return r ? { ...r, valor: Number(r.valor) || 0 } : null;
};

/** The logged-in person's open renewal Pix, or null. Refreshes when the app regains focus. */
export function useRenovacaoPixQuery(userId: string | undefined) {
  return useQuery({
    queryKey: renovacaoKeys.byUser(userId ?? ""),
    enabled: !!userId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<RenovacaoPix | null> => {
      const { data, error } = await supabase.rpc("renovacao_pix_pendente" as never);
      if (error) throw error;
      return primeira(data);
    },
  });
}

/** Same, for /assinar?t=… opened from the store app (no session). */
export function useRenovacaoPixPorToken(token: string | null) {
  return useQuery({
    queryKey: renovacaoKeys.list({ token }),
    enabled: !!token,
    retry: 0,
    queryFn: async (): Promise<RenovacaoPix | null> => {
      const { data, error } = await supabase.rpc("assinar_token_pix" as never, { p_token: token } as never);
      if (error) throw error;
      return primeira(data);
    },
  });
}
