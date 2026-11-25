/* Aba Estoque (25/11): recent movements of ONE ingredient, read-only — what came in from Mercado
   purchases and what went out in productions (the new production flow's ledger). */
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";

const num = z.coerce.number().catch(0);
const compra = z.object({ quantidade: num, total_pago: num, data: z.string().nullable().catch(null), created_at: z.string() });
const mov = z.object({ delta: num, antes: num, depois: num, criado_em: z.string() });
export interface Movimento { quando: string; tipo: "compra" | "producao"; quantidade: number; valor?: number; depois?: number }

type Sel = { select: (c: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: unknown[] | null; error: unknown }> } } } } };
const de = (t: string) => (supabase as unknown as { from: (t: string) => Sel }).from(t);

export function useMovimentosIngredienteQuery(ingredienteId: string | null) {
  return useQuery({
    queryKey: produtosKeys.detail(`movimentos:${ingredienteId ?? ""}`),
    enabled: !!ingredienteId,
    queryFn: async (): Promise<Movimento[]> => {
      const [c, m] = await Promise.all([
        de("compras_mercadoria").select("quantidade, total_pago, data, created_at").eq("ingredient_id", ingredienteId!).eq("item_tipo", "ingrediente").order("created_at", { ascending: false }).limit(15),
        de("producao_movimentos").select("delta, antes, depois, criado_em").eq("alvo_id", ingredienteId!).eq("alvo", "ingrediente").order("criado_em", { ascending: false }).limit(15),
      ]);
      const compras = c.error ? [] : z.array(compra).parse(c.data ?? []).map((x): Movimento => ({ quando: x.created_at, tipo: "compra", quantidade: x.quantidade, valor: x.total_pago }));
      const saidas = m.error ? [] : z.array(mov).parse(m.data ?? []).map((x): Movimento => ({ quando: x.criado_em, tipo: "producao", quantidade: x.delta, depois: x.depois }));
      return [...compras, ...saidas].sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 15);
    },
  });
}
