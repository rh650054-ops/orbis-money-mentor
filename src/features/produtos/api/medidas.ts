/* 25/11 (medida de uso): what a package holds, its name and the unit a line was typed in.
   Read apart and tolerantly: before migration 20261125200000 the columns do not exist and every
   recipe keeps working exactly as before (quantities are always stored in the ingredient's unit). */
import { z } from "zod";
import { supabase } from "@/shared/api";
import type { ItemReceita } from "../types";
import type { Conteudo, UnidadeUso } from "../lib/medidas";

type Rpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
type Ler = PromiseLike<{ data: unknown[] | null; error: unknown }>;
export const tabela = (t: string) => (supabase as unknown as { from: (t: string) => { select: (c: string) => { in: (c: string, v: string[]) => Ler; eq: (c: string, v: string) => Ler; limit: (n: number) => Ler } } }).from(t);
/** the function is not in the database yet (migration not applied) */
const semFuncao = (e: unknown) => { const x = e as { code?: string; message?: string } | null; return x?.code === "PGRST202" || /could not find the function/i.test(x?.message ?? ""); };

const ingSchema = z.object({
  id: z.string(), conteudo_qtd: z.coerce.number().nullable().catch(null), conteudo_unidade: z.enum(["g", "ml"]).nullable().catch(null),
  embalagem_nome: z.string().nullable().catch(null),
});
export interface MedidaDoIngrediente { conteudo: Conteudo | null; embalagem: string | null }
/** null = the database has no such columns (then nothing is added to the lines) */
export async function lerMedidasDosIngredientes(ids: string[]): Promise<Map<string, MedidaDoIngrediente> | null> {
  if (ids.length === 0) return new Map();
  const r = await tabela("ingredients").select("id, conteudo_qtd, conteudo_unidade, embalagem_nome").in("id", ids);
  if (r.error) return null;
  return new Map(z.array(ingSchema).parse(r.data ?? []).map((i) => [i.id, {
    conteudo: i.conteudo_qtd && i.conteudo_qtd > 0 && i.conteudo_unidade ? { qtd: i.conteudo_qtd, unidade: i.conteudo_unidade } : null,
    embalagem: i.embalagem_nome,
  }]));
}

const usoSchema = z.object({ ingredient_id: z.string(), variant_id: z.string().nullable(), unidade_uso: z.enum(["un", "g", "kg", "ml", "l"]).nullable().catch(null) });
/** "variant or -" + ":" + ingredient → the unit typed; null = no column */
export async function lerUnidadesDeUso(produtoId: string): Promise<Map<string, UnidadeUso | null> | null> {
  const r = await tabela("product_recipes").select("ingredient_id, variant_id, unidade_uso").eq("product_id", produtoId);
  if (r.error) return null;
  return new Map(z.array(usoSchema).parse(r.data ?? []).map((l) => [`${l.variant_id ?? "-"}:${l.ingredient_id}`, l.unidade_uso]));
}

/** After the recipe is saved: remember how each line was measured. Only for lines that came from a
 *  database with the columns (embalagem !== undefined); an old database is never called. */
export async function salvarMedidas(produtoId: string, itens: (Pick<ItemReceita, "nome" | "unidade" | "unidadeUso" | "conteudo" | "embalagem"> & { sabor?: string })[]): Promise<void> {
  const com = itens.filter((i) => i.embalagem !== undefined || i.conteudo || i.unidadeUso);
  if (com.length === 0) return;
  const { error } = await (supabase.rpc as unknown as Rpc)("receita_definir_medidas", {
    p_produto: produtoId,
    p_itens: com.map((i) => ({
      nome: i.nome, ...(i.sabor ? { sabor: i.sabor } : {}),
      ...(i.unidadeUso && i.unidadeUso !== i.unidade ? { unidade_uso: i.unidadeUso } : {}),
      ...(i.conteudo ? { conteudo_qtd: i.conteudo.qtd, conteudo_unidade: i.conteudo.unidade } : {}),
      ...(i.unidade === "un" && i.embalagem !== undefined ? { embalagem: i.embalagem ?? "" } : {}),
    })),
  });
  if (error && !semFuncao(error)) throw error;
}
