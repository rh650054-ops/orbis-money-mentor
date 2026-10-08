import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api";

/* "Passe" (08/10/2026): carries the logged-in user from the old address to the new one
   without the password. The old address asks for a one-time code; the new one trades it
   for a sign-in (edge function passe-dominio). */

export function useCriarPasseMutation() {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.functions.invoke("passe-dominio", { body: { acao: "criar" } });
      const codigo = (data as { codigo?: string } | null)?.codigo;
      if (error || !codigo) throw error ?? new Error("sem_passe");
      return codigo;
    },
  });
}

export function useTrocarPasseMutation() {
  return useMutation({
    mutationFn: async (codigo: string): Promise<void> => {
      const { data, error } = await supabase.functions.invoke("passe-dominio", { body: { acao: "trocar", codigo } });
      const tokenHash = (data as { token_hash?: string } | null)?.token_hash;
      if (error || !tokenHash) throw error ?? new Error("passe_invalido");
      const { error: e2 } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (e2) throw e2;
    },
  });
}
