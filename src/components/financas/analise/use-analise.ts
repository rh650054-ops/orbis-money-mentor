/* Dados da aba Análise via React Query (cache por mês: voltar pro mês anterior é instantâneo). */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createQueryKeys, supabase } from "@/shared/api";
import type { Analise, CategoriaDef, Lancamento, Revisao } from "./tipos";

export const analiseKeys = createQueryKeys("analise");

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);
async function chamar<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function useAnalise(mes: string, ativo = true) {
  return useQuery({
    queryKey: analiseKeys.list({ q: "mes", mes }),
    queryFn: () => chamar<Analise>("financas_rastreador", { p_mes: mes }),
    enabled: ativo, placeholderData: keepPreviousData,
  });
}

export function useRevisao(mes: string, ativo = true) {
  return useQuery({
    queryKey: analiseKeys.list({ q: "revisar", mes }),
    queryFn: () => chamar<Revisao>("analise_revisar", { p_mes: mes }),
    enabled: ativo, placeholderData: keepPreviousData,
  });
}

export function useLancamentos(mes: string, categoria: string | null, esfera: "pessoal" | "corre" | null, ativo: boolean) {
  return useQuery({
    queryKey: analiseKeys.list({ q: "lancamentos", mes, categoria, esfera }),
    queryFn: async () => ((await chamar<Lancamento[]>("analise_lancamentos", { p_mes: mes, p_categoria: categoria, p_esfera: esfera })) ?? [])
      .map((l) => ({ ...l, valor: Number(l.valor) || 0 })),
    enabled: ativo,
  });
}

export function useCategoriasSaida() {
  return useQuery({
    queryKey: analiseKeys.list({ q: "categorias" }),
    queryFn: async () => {
      const { data, error } = await supabase.from("extrato_categorias" as never)
        .select("slug,rotulo,tipo,esfera_padrao,ordem").eq("tipo" as never, "saida" as never).order("ordem" as never);
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as CategoriaDef[]).filter((c) => !["estorno", "fatura_cartao", "nao_identificado"].includes(c.slug));
    },
    staleTime: 10 * 60_000,
  });
}

export type AcaoLancamento =
  | { tipo: "mover"; id: string; categoria: string; todos: boolean }
  | { tipo: "renomear"; id: string; nome: string }
  | { tipo: "fora"; id: string; fora: boolean };

/** Toda correção num lançamento: grava e recarrega a aba inteira (totais, categorias, fila). */
export function useAcaoLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: AcaoLancamento) =>
      a.tipo === "mover" ? chamar(a.todos ? "extrato_mover" : "extrato_mover_um", { p_id: a.id, p_categoria: a.categoria })
        : a.tipo === "renomear" ? chamar("extrato_renomear", { p_id: a.id, p_nome: a.nome })
        : chamar("extrato_fora_analise", { p_id: a.id, p_fora: a.fora }),
    onSuccess: () => qc.invalidateQueries({ queryKey: analiseKeys.all }),
  });
}
