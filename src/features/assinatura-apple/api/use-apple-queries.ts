import { useQuery } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";
import { ponteApple } from "../lib/ponte";
import type { OfertaApple, ProdutoApple } from "../types";

export const assinaturaAppleKeys = createQueryKeys("assinatura-apple");

const PLANOS = ["livre", "trocar", "bloqueado"];
/** Anything unexpected from the server means "do not offer". */
export function lerOferta(raw: unknown): OfertaApple {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const plano = PLANOS.includes(r.plano as string) ? (r.plano as OfertaApple["plano"]) : "bloqueado";
  const apple = r.apple && typeof r.apple === "object" ? (r.apple as OfertaApple["apple"]) : null;
  const banco = ["livre", "ja_tem", "sem_plano", "bloqueado"].includes(r.banco as string) ? (r.banco as OfertaApple["banco"]) : "bloqueado";
  return { plano, motivo: (typeof r.motivo === "string" ? r.motivo : null) as OfertaApple["motivo"], apple, banco };
}

/** May this account be offered a purchase on the iPhone? Decided by public.assinatura_apple_oferta(). */
export function useOfertaAppleQuery(userId: string | undefined) {
  return useQuery({
    queryKey: assinaturaAppleKeys.byUser(userId ?? ""),
    enabled: !!userId && !!ponteApple(),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<OfertaApple> => {
      const { data, error } = await supabase.rpc("assinatura_apple_oferta" as never);
      if (error) throw new Error(error.message);
      return lerOferta(data);
    },
  });
}

/** Products and localized prices, straight from StoreKit. */
export function useProdutosAppleQuery(ids: string[]) {
  return useQuery({
    queryKey: assinaturaAppleKeys.list({ ids }),
    enabled: !!ponteApple(),
    staleTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ProdutoApple[]> => {
      const p = ponteApple();
      if (!p) return [];
      return (await p.produtos({ ids })).produtos;
    },
  });
}
