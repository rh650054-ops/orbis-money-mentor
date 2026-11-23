/* New production flow (Etapa 1 + 23/11): server preview and the recent list. */
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);
const num = z.coerce.number().catch(0);

export type ItemEnvio = { produto: string; sabor?: string; unidades: number };

const consumoSchema = z.object({ ingrediente: z.string(), nome: z.string(), unidade: z.string().nullable().catch("un"), receita: num, real: num });
const faltaSchema = z.object({ ingrediente: z.string(), nome: z.string(), unidade: z.string().nullable().catch("un"), precisa: num, tem: num });
export const simulacaoSchema = z.object({
  consumo: z.array(consumoSchema).catch([]), faltas: z.array(faltaSchema).catch([]), avisos: z.array(z.string()).catch([]),
});
export type Simulacao = z.infer<typeof simulacaoSchema>;

const itemSchema = z.object({ produto: z.string(), sabor: z.string().nullable().catch(null), unidades: num, produto_nome: z.string().catch(""), sabor_nome: z.string().nullable().catch(null) });
export const respostaSchema = z.object({
  registro_id: z.string(), status: z.string().catch("ativa"), versao: num, repetido: z.boolean().catch(false),
  itens: z.array(itemSchema).catch([]), consumo: z.array(consumoSchema).catch([]),
});
export type RespostaProducao = z.infer<typeof respostaSchema>;
const recenteSchema = z.object({ id: z.string(), status: z.string(), versao: num, criado_em: z.string(), itens: z.array(itemSchema).catch([]) });
export type ProducaoRecente = z.infer<typeof recenteSchema>;

export const producaoKey = (userId: string | undefined) => produtosKeys.list({ tela: "producao-recentes", userId });

/** Preview from the server (same rules as registering); refusals come back as errors. */
export function useSimularProducaoQuery(itens: ItemEnvio[], justificativa: string | null) {
  return useQuery({
    queryKey: produtosKeys.list({ tela: "producao-simular", itens: JSON.stringify(itens), justificativa }),
    enabled: itens.length > 0,
    retry: false,
    staleTime: 0,
    queryFn: async (): Promise<Simulacao> => {
      const { data, error } = await rpc("producao_simular", { p_itens: itens, p_justificativa: justificativa });
      if (error) throw error;
      return simulacaoSchema.parse(data);
    },
  });
}

export function useProducaoRecentesQuery(userId: string | undefined) {
  return useQuery({
    queryKey: producaoKey(userId),
    enabled: !!userId,
    queryFn: async (): Promise<ProducaoRecente[]> => {
      const { data, error } = await rpc("producao_recentes", { p_limite: 15 });
      if (error) throw error;
      return z.array(recenteSchema).parse(data ?? []);
    },
  });
}

