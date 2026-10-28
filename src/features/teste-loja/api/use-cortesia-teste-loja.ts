import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api";

export type RespostaCortesia = "aplicada" | "ja_tinha" | "fora";

/** Asks the server for the closed-test courtesy (30-day test). The server applies the rules. */
export function useCortesiaTesteLoja() {
  return useMutation({
    mutationFn: async (): Promise<RespostaCortesia> => {
      const { data, error } = await supabase.rpc("cortesia_teste_loja_pedir" as never);
      if (error) throw error;
      return (data as unknown as RespostaCortesia) ?? "fora";
    },
  });
}
