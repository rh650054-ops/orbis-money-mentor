import { z } from "zod";

const n = z.coerce.number().catch(0);

export const categoriaSchema = z.object({
  categoria: z.string(), rotulo: z.string().catch(""), esfera: z.string().catch("pessoal"),
  total: n, qtd: n, pct: n, anterior: n,
});
export type CategoriaRX = z.infer<typeof categoriaSchema>;

export const contaSchema = z.object({
  banco: z.string().catch("Banco"), uso: z.string().catch("pessoal"), saiu: n, entrou: n, qtd: n,
});

export const resumoSchema = z.object({
  mes: z.string(), saiu: n, entrou: n, lancamentos: n,
  bancos: z.array(z.string()).catch([]),
  corre: n, pessoal: n, nao_identificados: n, perguntas: n,
  entre_contas: z.object({ saiu: n, entrou: n, qtd: n, pares: n }).catch({ saiu: 0, entrou: 0, qtd: 0, pares: 0 }),
  contas: z.array(contaSchema).catch([]),
  categorias: z.array(categoriaSchema).catch([]),
});
export type ResumoRX = z.infer<typeof resumoSchema>;

export const lancamentoSchema = z.object({
  id: z.string(), data: z.string(), hora: z.string().nullable().catch(null),
  descricao: z.string().catch(""), comerciante: z.string().nullable().catch(null),
  valor: n, categoria: z.string().catch("nao_identificado"), esfera: z.string().catch("pessoal"),
  banco: z.string().nullable().catch(null), tipo: z.string().catch("saida"), movimento: z.string().catch("normal"),
});
export type LancamentoRX = z.infer<typeof lancamentoSchema>;

/** Filters of the search sheet (all optional, combinable). */
export interface Filtros {
  texto: string;
  bancos: string[];
  categorias: string[];
  esfera: "corre" | "pessoal" | null;
  tipo: "saida" | "entrada" | null;
  transferencias: boolean;      // only internal transfers
  identificacao: "sim" | "nao" | null;
  min: number | null;
  max: number | null;
}
export const FILTROS_VAZIOS: Filtros = { texto: "", bancos: [], categorias: [], esfera: null, tipo: null, transferencias: false, identificacao: null, min: null, max: null };
