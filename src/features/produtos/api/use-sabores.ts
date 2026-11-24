/* Sabores de um produto (26/10/2026): lista com estoque e custo, salvar, produzir por
   sabor e distribuir o que já está no estoque entre os sabores. */
import { precoParaGravar } from "./salvar-receita";
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
export interface Sabor { id: string; nome: string; emoji: string; estoque: number; custo: number; extras: ExtraDoSabor[]; rende?: number | null; usaBase?: boolean; foto?: string | null }

type Linhas = PromiseLike<{ data: unknown[] | null; error: unknown }>;
type Tabela = { select: (c: string) => { eq: (c: string, v: string) => Linhas } };
const extraVariante = z.object({ id: z.string(), batch_yield: z.coerce.number().nullable().catch(null), usa_base: z.boolean().catch(true), photo_url: z.string().nullable().catch(null).optional() });
/** 23/11: each flavour's own yield and "usa a base" (before the migration the columns do not exist: defaults). */
async function rendimentos(produtoId: string): Promise<Map<string, { rende: number | null; usaBase: boolean; foto?: string | null }>> {
  const de = (cols: string) => (supabase as unknown as { from: (t: string) => Tabela }).from("product_variants").select(cols).eq("product_id", produtoId);
  // 24/11: the flavour's own photo; a database without the column answers with an error -> read without it
  let r = await de("id, batch_yield, usa_base, photo_url");
  if (r.error) r = await de("id, batch_yield, usa_base");
  if (r.error) return new Map();
  return new Map(z.array(extraVariante).parse(r.data ?? []).map((v) => [v.id, { rende: v.batch_yield, usaBase: v.usa_base, foto: v.photo_url ?? null }]));
}

export const saboresKey = (produtoId: string) => produtosKeys.detail(`${produtoId}:sabores`);

export function useSaboresQuery(produtoId: string | undefined, ativo = true) {
  return useQuery({
    queryKey: saboresKey(produtoId ?? ""),
    enabled: !!produtoId && ativo,
    queryFn: async (): Promise<Sabor[]> => {
      const [{ data, error }, extra] = await Promise.all([rpc("produto_sabores", { p_produto: produtoId }), rendimentos(produtoId ?? "")]);
      if (error) throw error;
      return z.array(saborSchema).parse(data ?? []).map((s) => ({
        ...s, ...(extra.get(s.id) ?? {}), extras: s.extras.map((e) => ({ ...e, unidade: unidadeDe(e.unidade), pacote: e.pacote > 0 ? e.pacote : 1 })),
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

export async function salvarSabores(produtoId: string, sabores: { id?: string; nome: string; emoji: string; rende?: number | null; usaBase?: boolean; itens: { id?: string; nome: string; qtd: number; preco: number; unidade: Unidade; pacote: number; aprender?: boolean; precoEditado?: boolean }[] }[]) {
  const { error } = await rpc("produto_sabores_salvar", {
    p_produto: produtoId,
    // 23/11: rende (null = the product's) and usa_base go too; a database before the
    // yield-per-flavour migration simply ignores the two keys
    p_sabores: sabores.map((s) => ({
      ...(s.id ? { id: s.id } : {}), nome: s.nome, emoji: s.emoji,
      ...(s.rende !== undefined ? { rende: s.rende } : {}), ...(s.usaBase !== undefined ? { usa_base: s.usaBase } : {}),
      itens: s.itens.map((i) => ({ ...(i.id ? { id: i.id } : {}), nome: i.nome, qtd: i.qtd, preco: precoParaGravar(i), ...(i.aprender ? { aprender: true } : {}) })),
    })),
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
