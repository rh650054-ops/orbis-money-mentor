import { useQuery } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";
import { relatorioSchema, type Relatorio } from "../types";

export const relatorioKeys = createQueryKeys("relatorio");

type RpcClient = { rpc: (fn: string, args: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> };

/** One round-trip: the server returns the period, the previous one and the 30-day baseline. */
async function buscarRelatorio(de: string, ate: string): Promise<Relatorio> {
  const { data, error } = await (supabase as unknown as RpcClient).rpc("relatorio_periodo", { p_de: de, p_ate: ate });
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("Sem sessão: entre de novo pra ver o relatório.");
  return relatorioSchema.parse(data);
}

export function useRelatorioQuery(de: string, ate: string) {
  return useQuery({
    queryKey: relatorioKeys.list({ de, ate }),
    queryFn: () => buscarRelatorio(de, ate),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
