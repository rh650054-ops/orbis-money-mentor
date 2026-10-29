import { useMutation, useQuery } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";

/* Equipe comercial (Rick, 29/10/2026): Paulo e Yan chamam qualquer lead do ranking no
   WhatsApp. O servidor decide quem é da equipe (is_orbis_crm) e entrega o número um a um. */
export const equipeKeys = createQueryKeys("equipe-comercial");

export function useEquipeComercialQuery(userId: string | undefined) {
  return useQuery({
    queryKey: equipeKeys.byUser(userId ?? ""),
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("is_orbis_crm");
      if (error) return false;
      return data === true;
    },
  });
}

/** The lead's WhatsApp number (digits, with 55), or null when he has none. */
export function useWhatsappLeadMutation() {
  return useMutation({
    mutationFn: async (userId: string): Promise<string | null> => {
      const { data, error } = await supabase.rpc("ranking_whatsapp_lead" as never, { p_user: userId } as never);
      if (error) throw error;
      const numero: unknown = data;
      return typeof numero === "string" && numero.length >= 12 ? numero : null;
    },
  });
}
