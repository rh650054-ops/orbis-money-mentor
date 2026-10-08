import { useQuery } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";

export const avisoDominioKeys = createQueryKeys("aviso-dominio");

/** Rick's switch: app_settings.aviso_novo_dominio = 'on' turns the popup on for everyone on the old address. */
export function useAvisoDominioLigadoQuery(habilitado: boolean) {
  return useQuery({
    queryKey: avisoDominioKeys.all,
    enabled: habilitado,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "aviso_novo_dominio")
        .maybeSingle();
      if (error) throw error;
      return (data?.value ?? "").trim().toLowerCase() === "on";
    },
  });
}
