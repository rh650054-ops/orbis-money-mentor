import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { produtosKeys } from "./use-produtos-query";

/* Produto e estoque são do VANT Pro (Rick, 23/10/2026).
   Liberado: Pro de verdade, teste grátis ainda valendo, equipe/cortesia (billing_exempt).
   Bloqueado: Essencial (R$ 29,90). Expirado nem chega aqui (o PaywallGate trava antes). */
export type AcessoProdutos = { liberado: boolean; assinaEssencial: boolean };

export function liberaProdutos(p: {
  pro: boolean; billingExempt: boolean; trialAtivo: boolean; trialEnd: string | null; planStatus: string | null; hoje: string;
}): AcessoProdutos {
  const emTeste = p.trialAtivo && !!p.trialEnd && p.trialEnd >= p.hoje;
  const liberado = p.pro || p.billingExempt || emTeste;
  return { liberado, assinaEssencial: !liberado && p.planStatus === "active" };
}

export function useAcessoProdutosQuery(userId: string | undefined) {
  return useQuery({
    queryKey: produtosKeys.list({ tela: "acesso", userId }),
    enabled: !!userId,
    queryFn: async (): Promise<AcessoProdutos> => {
      const [perfil, pro] = await Promise.all([
        supabase.from("profiles").select("plan_status, billing_exempt, is_trial_active, trial_end").eq("user_id", userId!).maybeSingle(),
        supabase.rpc("orbis_pro_status" as never),
      ]);
      if (perfil.error) throw perfil.error;
      const linha = ((pro.data as unknown as { pro?: boolean }[] | null) ?? [])[0];
      return liberaProdutos({
        pro: !!linha?.pro,
        billingExempt: !!perfil.data?.billing_exempt,
        trialAtivo: !!perfil.data?.is_trial_active,
        trialEnd: perfil.data?.trial_end ?? null,
        planStatus: perfil.data?.plan_status ?? null,
        hoje: getBrazilDate(),
      });
    },
  });
}
