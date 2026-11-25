/* 25/11 (medida de uso): is migration 20261125200000 applied? Until then a box is only used by the box
   (its content could not be remembered); everything else works as before. */
import { useQuery } from "@tanstack/react-query";
import { tabela } from "./medidas";
import { produtosKeys } from "./use-produtos-query";

export function useMedidaDeUsoDisponivel() {
  return useQuery({
    queryKey: produtosKeys.detail("medida-de-uso-disponivel"),
    staleTime: 10 * 60_000,
    queryFn: async () => !(await tabela("ingredients").select("conteudo_qtd").limit(1)).error,
  });
}
