import { useQuery } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";
import { contaSchema, proSchema, type Conta, type ProStatus } from "../types";

export const contaKeys = createQueryKeys("conta");

const CAMPOS =
  "user_id, nickname, email, phone, city, state, avatar_url, created_at, plan_status, trial_end, is_demo, billing_exempt, comp_label, " +
  "bio, what_i_sell, where_i_sell, instagram, whatsapp_public, show_instagram, show_whatsapp, show_city, ranking_oculto";

/** The vendor's own account + the Pro side of the plan. */
export function useContaQuery(userId: string | undefined) {
  return useQuery({
    queryKey: contaKeys.byUser(userId ?? ""),
    enabled: !!userId,
    queryFn: async (): Promise<{ conta: Conta; pro: ProStatus | null }> => {
      const [perfil, pro] = await Promise.all([
        supabase.from("profiles").select(CAMPOS).eq("user_id", userId!).maybeSingle(),
        (supabase.rpc as unknown as (f: string) => PromiseLike<{ data: unknown; error: unknown }>)("orbis_pro_status"),
      ]);
      if (perfil.error) throw perfil.error;
      if (!perfil.data) throw new Error("perfil não encontrado");
      const linha = Array.isArray(pro.data) ? pro.data[0] : pro.data;
      return {
        conta: contaSchema.parse(perfil.data),
        pro: pro.error || !linha ? null : proSchema.parse(linha),
      };
    },
  });
}
