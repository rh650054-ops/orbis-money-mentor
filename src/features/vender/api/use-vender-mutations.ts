/* Writes on the Vender screen. Every write refreshes the numbers it touches. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { definirPapel, desligarBanco } from "@/components/conectar/pluggy";
import { puxarBancoAgora } from "@/components/conectar/banco-pix";
import { venderKeys } from "./keys";

/** The bank answers in 10–60 s: stay "reading" ~20 s, refresh, then once more at 60 s. */
export function useAtualizarAgoraMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await puxarBancoAgora();
      await new Promise((r) => setTimeout(r, 20_000));
    },
    onSettled: () => {
      const tudo = () => void qc.invalidateQueries({ queryKey: venderKeys.all });
      tudo();
      setTimeout(tudo, 40_000);
    },
  });
}

export function usePapelMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, papel }: { id: string; papel: "trabalho" | "pessoal" }) => definirPapel(id, papel),
    onSuccess: () => void qc.invalidateQueries({ queryKey: venderKeys.all }),
  });
}

export function useDesligarMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => desligarBanco(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: venderKeys.all }),
  });
}
