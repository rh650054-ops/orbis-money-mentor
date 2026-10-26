/* Detalhe de uma compra antiga do "Tô no mercado" (Rick, 26/10/2026): itens com preço,
   o que virou produto (levas, unidades, custo de cada) — só leitura. */
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";

const num = z.coerce.number().catch(0);
// mercado_compras / production_batches fora dos tipos gerados: construtor solto, resultado validado com zod
type R = PromiseLike<{ data: unknown; error: Error | null }>;
interface Q extends R {
  select: (c: string) => Q; eq: (k: string, v: unknown) => Q; in: (k: string, v: unknown[]) => Q;
  gte: (k: string, v: string) => Q; lte: (k: string, v: string) => Q; order: (c: string) => Q; maybeSingle: () => R;
}
type Sb = { from: (t: string) => Q };
const sb = supabase as unknown as Sb;

const compraSchema = z.object({ id: z.string(), total: num, criada_em: z.string() });
const itemSchema = z.object({
  item_tipo: z.string().catch("ingrediente"), quantidade: num, total_pago: num,
  custo_anterior: z.coerce.number().nullable().catch(null), custo_novo: z.coerce.number().nullable().catch(null),
  ingredients: z.object({ name: z.string(), unit: z.string().nullable().catch("un"), pacote_qtd: num }).nullable().catch(null),
  products: z.object({ name: z.string() }).nullable().catch(null),
});
const loteSchema = z.object({ product_id: z.string(), batches_count: num, units_produced: num });
const prodSchema = z.object({ id: z.string(), name: z.string(), cost: num });

export interface ItemCompraDetalhe { nome: string; qtd: number; unidade: string; pacote: number; total: number; precoAntes: number | null; precoAgora: number | null }
export interface ProdutoFeito { id: string; nome: string; levas: number; unidades: number; custo: number }
export interface CompraDetalhe { id: string; total: number; criadaEm: string; itens: ItemCompraDetalhe[]; feitos: ProdutoFeito[] }

export function useCompraDetalheQuery(id: string | null) {
  return useQuery({
    queryKey: produtosKeys.detail(`compra-detalhe:${id ?? ""}`),
    enabled: !!id,
    queryFn: async (): Promise<CompraDetalhe | null> => {
      const { data: c, error } = await sb.from("mercado_compras").select("id, total, criada_em").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!c) return null;
      const compra = compraSchema.parse(c);
      const { data: its, error: e2 } = await sb.from("compras_mercadoria")
        .select("item_tipo, quantidade, total_pago, custo_anterior, custo_novo, ingredients(name, unit, pacote_qtd), products(name)")
        .eq("mercado_compra_id", compra.id).order("created_at");
      if (e2) throw e2;
      // levas feitas pela compra: gravadas no mesmo instante (até 2 min depois)
      const ini = new Date(new Date(compra.criada_em).getTime() - 5_000).toISOString();
      const fim = new Date(new Date(compra.criada_em).getTime() + 120_000).toISOString();
      const { data: lotes, error: e3 } = await sb.from("production_batches").select("product_id, batches_count, units_produced")
        .eq("notes", "Tô no mercado").gte("created_at", ini).lte("created_at", fim);
      if (e3) throw e3;
      const ls = z.array(loteSchema).parse(lotes ?? []);
      const ids = [...new Set(ls.map((l) => l.product_id))];
      const { data: ps } = ids.length ? await sb.from("products").select("id, name, cost").in("id", ids) : { data: [] as unknown[] };
      const porId = new Map(z.array(prodSchema).parse(ps ?? []).map((p) => [p.id, p]));
      const feitos = ids.map((pid) => {
        const meus = ls.filter((l) => l.product_id === pid);
        const p = porId.get(pid);
        return { id: pid, nome: p?.name ?? "Produto", levas: meus.reduce((s, l) => s + l.batches_count, 0), unidades: meus.reduce((s, l) => s + l.units_produced, 0), custo: p?.cost ?? 0 };
      });
      const itens = z.array(itemSchema).parse(its ?? []).map((i) => ({
        nome: i.ingredients?.name ?? i.products?.name ?? "Item", qtd: i.quantidade, unidade: i.ingredients?.unit ?? "un",
        pacote: i.ingredients?.pacote_qtd && i.ingredients.pacote_qtd > 0 ? i.ingredients.pacote_qtd : 1, total: i.total_pago,
        precoAntes: i.custo_anterior, precoAgora: i.custo_novo,
      }));
      return { id: compra.id, total: compra.total, criadaEm: compra.criada_em, itens, feitos };
    },
  });
}
