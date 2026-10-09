import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { reduzirImagem } from "@/shared/lib/imagem";

/** Foto do produto: reduz no celular e sobe no bucket product-photos. Devolve a URL pública. */
export function useSubirFotoMutation(userId: string | undefined) {
  return useMutation({
    mutationFn: async (original: File): Promise<string> => {
      if (!userId) throw new Error("sem_login");
      const file = await reduzirImagem(original, 1200);
      if (file.size > 5 * 1024 * 1024) throw new Error("foto_grande");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-photos").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      return supabase.storage.from("product-photos").getPublicUrl(path).data.publicUrl;
    },
  });
}
