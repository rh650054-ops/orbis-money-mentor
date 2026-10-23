import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";

/* Report and block in the community (Google UGC policy / Apple 1.2, 23/10/2026). */
export const moderacaoKeys = createQueryKeys("moderacao");

export type MotivoDenuncia = "ofensivo" | "golpe" | "spam" | "sexual" | "outro";

/** Ids of the people I blocked (their posts and comments are hidden for me). */
export function useBloqueadosQuery(userId: string | undefined) {
  return useQuery({
    queryKey: moderacaoKeys.byUser(userId ?? ""),
    enabled: !!userId,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from("community_bloqueios" as never).select("bloqueado").eq("quem", userId!);
      if (error) throw error;
      return new Set(((data ?? []) as unknown as { bloqueado: string }[]).map((r) => r.bloqueado));
    },
  });
}

export function useDenunciarMutation() {
  return useMutation({
    mutationFn: async (a: { postId?: string; commentId?: string; motivo: MotivoDenuncia }) => {
      const { error } = await supabase.rpc("community_denunciar" as never, {
        p_post: a.postId ?? null, p_comment: a.commentId ?? null, p_motivo: a.motivo, p_detalhe: null,
      } as never);
      if (error) throw error;
    },
  });
}

export function useBloquearMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bloqueado: string) => {
      const { error } = await supabase.from("community_bloqueios" as never).insert({ quem: userId, bloqueado } as never);
      if (error && error.code !== "23505") throw error; // already blocked = fine
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: moderacaoKeys.byUser(userId ?? "") }),
  });
}
