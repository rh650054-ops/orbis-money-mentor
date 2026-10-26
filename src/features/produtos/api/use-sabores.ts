/* Sabores de um produto (26/10/2026): lista com estoque e custo, salvar, produzir por
   sabor e distribuir o que já está no estoque entre os sabores. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { unidadeDe, type Unidade } from "../types";
import { produtosKeys } from "./use-produtos-query";

const num = z.coerce.number().catch(0);
type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

const extraSchema = z.object({ id: z.string(), nome: z.string(), qtd: num, preco: num, unidade: z.string().nullable().catch("un"), pacote: num, estoque: num, aprender: z.boolean().catch(false) });
const saborSchema = z.object({ id: z.string(), nome: z.string(), emoji: z.string().catch("🥤"), estoque: num, custo: num, extras: z.array(extraSchema).catch([]) });

export interface ExtraDoSabor { id: string; nome: string; qtd: number; preco: number; unidade: Unidade; pacote: number; estoque: number; aprender?: boolean }
export interface Sabor { id: string; nome: string; emoji: string; estoque: number; custo: number; extras: ExtraDoSabor[] }

export const saboresKey = (produtoId: string) => produtosKeys.detail(`${produtoId}:sabores`);

export function useSaboresQuery(produtoId: string | undefined, ativo = true) {
  return useQuery({
    queryKey: saboresKey(produtoId ?? ""),
    enabled: !!produtoId && ativo,
    queryFn: async (): Promise<Sabor[]> => {
      const { data, error } = await rpc("produto_sabores", { p_produto: produtoId });
      if (error) throw error;
      return z.array(saborSchema).parse(data ?? []).map((s) => ({
        ...s, extras: s.extras.map((e) => ({ ...e, unidade: unidadeDe(e.unidade), pacote: e.pacote > 0 ? e.pacote : 1 })),
      }));
    },
  });
}

/** Sabores de vários produtos de uma vez (aba Estoque). */
export function useSaboresDeVariosQuery(produtoIds: string[]) {
  const chave = [...produtoIds].sort().join(",");
  return useQuery({
    queryKey: produtosKeys.list({ tela: "sabores-varios", chave }),
    enabled: produtoIds.length > 0,
    queryFn: async (): Promise<Record<string, Sabor[]>> => {
      const out: Record<string, Sabor[]> = {};
      await Promise.all(produtoIds.map(async (id) => {
        const { data, error } = await rpc("produto_sabores", { p_produto: id });
        if (error) throw error;
        const lista = z.array(saborSchema).parse(data ?? []);
        if (lista.length > 0) out[id] = lista.map((s) => ({ ...s, extras: s.extras.map((e) => ({ ...e, unidade: unidadeDe(e.unidade), pacote: e.pacote > 0 ? e.pacote : 1 })) }));
      }));
      return out;
    },
  });
}

export async function salvarSabores(produtoId: string, sabores: { id?: string; nome: string; emoji: string; itens: { id?: string; nome: string; qtd: number; preco: number; unidade: Unidade; pacote: number; aprender?: boolean }[] }[]) {
  const { error } = await rpc("produto_sabores_salvar", {
    p_produto: produtoId,
    p_sabores: sabores.map((s) => ({ ...(s.id ? { id: s.id } : {}), nome: s.nome, emoji: s.emoji, itens: s.itens.map((i) => ({ ...(i.id ? { id: i.id } : {}), nome: i.nome, qtd: i.qtd, preco: i.preco, ...(i.aprender ? { aprender: true } : {}) })) })),
  });
  if (error) throw error;
  // como cada extra é comprado (unidade e tamanho do pacote)
  const itens = sabores.flatMap((s) => s.itens.map((i) => ({ nome: i.nome, unidade: i.unidade, pacote: i.pacote })));
  if (itens.length > 0) {
    const r = await rpc("ingredientes_definir_compra", { p_itens: itens });
    if (r.error) throw r.error;
  }
}

/** A compra ensina a quantidade dos ingredientes marcados "descubro na compra". */
export interface Aprendido { nome: string; unidade: string; por_leva: number; por_unidade: number; custo_unidade: number }
export function useAprenderMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { compra: string; produto: string; unidades: number }) => {
      const { data, error } = await rpc("mercado_aprender", { p_compra: v.compra, p_produto: v.produto, p_unidades: v.unidades });
      if (error) throw error;
      return z.object({ aprendeu: z.array(z.object({ nome: z.string(), unidade: z.string().catch("un"), por_leva: num, por_unidade: num, custo_unidade: num })).catch([]), custo: num }).parse(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}

export function useProduzirSaboresMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { produto: string; sabores: { id: string; unidades: number }[] }) => {
      const { data, error } = await rpc("produto_produzir_sabores", { p_produto: v.produto, p_sabores: v.sabores });
      if (error) throw error;
      return z.object({ estoque: num, unidades: num }).parse(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}

export function useDistribuirSaboresMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { produto: string; sabores: { id: string; unidades: number }[] }) => {
      const { data, error } = await rpc("produto_sabores_distribuir", { p_produto: v.produto, p_sabores: v.sabores });
      if (error) throw error;
      return z.object({ distribuidas: num, sem_sabor: num }).parse(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}
