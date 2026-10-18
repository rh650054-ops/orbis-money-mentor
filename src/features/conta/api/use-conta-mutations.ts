import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { avisar } from "@/shared/lib/avisar";
import { syncLeaderboardRevenue } from "@/utils/syncDailySales";
import type { DadosConta, PerfilPublico } from "../types";
import { contaKeys } from "./use-conta-query";

const mesAtual = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);

/** Name/avatar also live on this month's ranking row. */
async function espelharNoRanking(userId: string, patch: { nome_usuario?: string; avatar_url?: string | null }) {
  await supabase.from("leaderboard_stats").update(patch).eq("user_id", userId).eq("mes_referencia", mesAtual());
}

/** Private account data (name, WhatsApp, city, e-mail). */
export function useSalvarDadosMutation(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: DadosConta) => {
      const { error } = await supabase.from("profiles").update({
        nickname: d.nickname.trim(), phone: d.phone.replace(/\D/g, ""), state: d.state, city: d.city.trim(),
        email: d.email.trim() || null,
      }).eq("user_id", userId);
      if (error) throw error;
      await espelharNoRanking(userId, { nome_usuario: d.nickname.trim() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contaKeys.byUser(userId) }),
  });
}

/** Public profile: presentation, public contacts and what is shown. */
export function useSalvarPerfilMutation(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<PerfilPublico>) => {
      const patch: Record<string, unknown> = { ...p };
      if (p.nickname !== undefined) patch.nickname = p.nickname.trim();
      for (const k of ["bio", "what_i_sell", "where_i_sell"] as const) if (p[k] !== undefined) patch[k] = p[k]!.trim() || null;
      if (p.instagram !== undefined) patch.instagram = p.instagram.trim().replace(/^@/, "") || null;
      if (p.whatsapp_public !== undefined) patch.whatsapp_public = p.whatsapp_public.replace(/\D/g, "") || null;
      const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
      if (error) throw error;
      if (p.nickname !== undefined) await espelharNoRanking(userId, { nome_usuario: p.nickname.trim() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contaKeys.byUser(userId) }),
  });
}

/** "Aparecer no ranking" — the server removes/restores this month's entry. */
export function useRankingVisivelMutation(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (aparecer: boolean) => {
      const rpc = supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ error: unknown }>;
      const { error } = await rpc("ranking_definir_oculto", { p_oculto: !aparecer });
      if (error) throw error;
      // back in the ranking: recompute this month now, not at the next closing
      if (aparecer) await syncLeaderboardRevenue(userId).catch((e) => avisar.erro("conta: recalcular ranking", e));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contaKeys.byUser(userId) }),
  });
}
