/* ACESSO POR PLANO (Rick, 25/10/2026) — uma leitura só: vant_acesso().
   plano: teste · essencial · essencial_banco · pro · pro_anual · equipe · sem_plano
   recursosPro: libera Caça-Sinal, meta adaptativa, X1, produtos (Pro, teste valendo, equipe).
   A trava de verdade mora no servidor; aqui é só pra tela. */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { createQueryKeys } from "./query-keys";

export type PlanoVant = "teste" | "essencial" | "essencial_banco" | "pro" | "pro_anual" | "equipe" | "sem_plano";
export interface Acesso { plano: PlanoVant; recursosPro: boolean; mentorLimite: number; mentorHoje: number }

const PLANOS: PlanoVant[] = ["teste", "essencial", "essencial_banco", "pro", "pro_anual", "equipe", "sem_plano"];
export const acessoKeys = createQueryKeys("acesso");

export function lerAcesso(raw: unknown): Acesso | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const plano = PLANOS.includes(r.plano as PlanoVant) ? (r.plano as PlanoVant) : "sem_plano";
  return { plano, recursosPro: r.recursos_pro === true, mentorLimite: Number(r.mentor_limite) || 0, mentorHoje: Number(r.mentor_hoje) || 0 };
}

export function useAcessoQuery(userId: string | undefined) {
  return useQuery({
    queryKey: acessoKeys.byUser(userId ?? ""),
    enabled: !!userId,
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as (f: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>)("vant_acesso");
      if (error) throw new Error(error.message);
      return lerAcesso(data);
    },
  });
}

/** Na dúvida (carregando ou erro), não trava: a trava de verdade é do servidor. */
export function travaPro(q: { data?: Acesso | null; isLoading: boolean; isError: boolean }): boolean {
  if (q.isLoading || q.isError || !q.data) return false;
  return !q.data.recursosPro;
}
