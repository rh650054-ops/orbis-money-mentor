import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { comprimirImagem } from "@/shared/lib/avatar";
import { contaKeys } from "./use-conta-query";

export type MudancaFoto =
  | { tipo: "arquivo"; arquivo: Blob }
  | { tipo: "avatar"; caminho: string }
  | { tipo: "remover" };

const mesAtual = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);

/** Photo, VANT avatar or nothing — saved on the profile and this month's ranking row. */
export function useFotoMutation(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: MudancaFoto): Promise<string | null> => {
      let url: string | null = null;
      if (m.tipo === "avatar") url = m.caminho;
      if (m.tipo === "arquivo") {
        // shrink on the phone first (512px JPEG): a 4 MB photo becomes ~60 KB
        const blob = m.arquivo instanceof File ? await comprimirImagem(m.arquivo, 512) : m.arquivo;
        const caminho = `${userId}/avatar.jpg`;
        const { error } = await supabase.storage.from("avatars").upload(caminho, blob, { upsert: true, contentType: "image/jpeg" });
        if (error) throw error;
        url = `${supabase.storage.from("avatars").getPublicUrl(caminho).data.publicUrl}?t=${Date.now()}`;
      }
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", userId);
      if (error) throw error;
      await supabase.from("leaderboard_stats").update({ avatar_url: url }).eq("user_id", userId).eq("mes_referencia", mesAtual());
      return url;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contaKeys.byUser(userId) }),
  });
}
