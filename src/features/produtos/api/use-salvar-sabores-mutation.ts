import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saboresParaSalvar, type SaborRascunho } from "../lib/sabores";
import { produtosKeys } from "./use-produtos-query";
import { salvarSabores } from "./use-sabores";

/** Flavours typed in the registration of a NEW product (22/11, Etapa 2). Same RPC as the product
 *  sheet; nothing is sent when no flavour has a name, so existing flavours are never touched. */
export function useSalvarSaboresMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ produtoId, sabores }: { produtoId: string; sabores: SaborRascunho[] }) => {
      const lista = saboresParaSalvar(sabores);
      if (lista.length > 0) await salvarSabores(produtoId, lista);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}
