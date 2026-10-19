/* Compras do "Tô no mercado": abrir uma pra editar e a lista das últimas (Rick, 19/10). */
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";

const num = z.coerce.number().catch(0);
type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);

export const compraAbertaSchema = z.object({
  id: z.string(), total: num, por_item: z.boolean().catch(true), desconto: num,
  produto_id: z.string().nullable().catch(null), unidades_previstas: num,
  itens: z.array(z.object({
    tipo: z.enum(["ingrediente", "produto", "novo"]).catch("novo"), id: z.string().nullable().catch(null),
    nome: z.string().catch(""), qtd: num, preco_unit: z.coerce.number().nullable().catch(null),
    para: z.array(z.string()).catch([]),
  })).catch([]),
});
export type CompraAberta = z.infer<typeof compraAbertaSchema>;

export function useCompraAbertaQuery(id: string | null) {
  return useQuery({
    queryKey: produtosKeys.detail(`compra:${id ?? ""}`),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await rpc("mercado_compra_abrir", { p_compra: id });
      if (error) throw error;
      return data ? compraAbertaSchema.parse(data) : null;
    },
  });
}

const resumoSchema = z.object({ id: z.string(), total: num, criada_em: z.string(), compras_mercadoria: z.array(z.object({ count: num })).catch([]) });
export function useComprasMercadoQuery(userId: string | undefined) {
  return useQuery({
    queryKey: produtosKeys.list({ tela: "compras", userId }),
    enabled: !!userId,
    queryFn: async () => {
      // mercado_compras ainda não está nos tipos gerados do Supabase
      const sb = supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown[] | null; error: Error | null }> } } } } };
      const { data, error } = await sb.from("mercado_compras").select("id, total, criada_em, compras_mercadoria(count)")
        .eq("user_id", userId ?? "").order("criada_em", { ascending: false }).limit(8);
      if (error) throw error;
      return z.array(resumoSchema).parse(data ?? []).map((c) => ({ id: c.id, total: c.total, criada_em: c.criada_em, itens: c.compras_mercadoria[0]?.count ?? 0 }));
    },
  });
}
