import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";
import { unidadeDe, type ItemReceita, type Unidade } from "../types";
import { lerMedidasDosIngredientes, lerUnidadesDeUso } from "./medidas";

const num = z.coerce.number().catch(0);
const linhaSchema = z.object({
  ingredient_id: z.string(), quantity: num, aprender: z.boolean().catch(false),
  // 25/11: absent before the migration (then every line is per recipe, as it always was)
  base: z.enum(["receita", "unidade"]).nullable().catch(null).optional(),
  qtd_por_unidade: z.coerce.number().nullable().catch(null).optional(),
});
const ingSchema = z.object({
  id: z.string(), name: z.string(), cost_per_unit: num, stock_quantity: num,
  unit: z.string().nullable().catch("un"), pacote_qtd: z.coerce.number().catch(1),
});

export interface IngredienteDaReceita extends Pick<ItemReceita, "unidadeUso" | "conteudo" | "embalagem"> {
  id: string; nome: string; qtd: number; preco: number; estoque: number; unidade: Unidade; pacote: number; aprender?: boolean;
  /** 25/11: per recipe or per unit produced; undefined = an old line, not classified (works per recipe) */
  por?: "receita" | "unidade";
}

/** A receita salva do produto, com o custo e o estoque atual de cada ingrediente. */
export function useReceitaQuery(produtoId: string | undefined) {
  return useQuery({
    queryKey: produtosKeys.detail(`${produtoId ?? ""}:receita`),
    enabled: !!produtoId,
    refetchOnMount: "always",
    queryFn: async (): Promise<IngredienteDaReceita[]> => {
      // só a BASE (26/10): os extras de cada sabor vêm em useSaboresQuery
      const ler = (campos: string) => supabase.from("product_recipes").select(campos).eq("product_id", produtoId!).is("variant_id", null);
      const novo = await ler("ingredient_id, quantity, aprender, base, qtd_por_unidade");
      const rec = novo.error && (novo.error as { code?: string }).code === "42703" ? await ler("ingredient_id, quantity, aprender") : novo;
      if (rec.error) throw rec.error;
      const linhas = z.array(linhaSchema).parse(rec.data ?? []);
      if (linhas.length === 0) return [];
      const ing = await supabase.from("ingredients").select("id, name, cost_per_unit, stock_quantity, unit, pacote_qtd")
        .in("id", linhas.map((l) => l.ingredient_id));
      if (ing.error) throw ing.error;
      const porId = new Map(z.array(ingSchema).parse(ing.data ?? []).map((i) => [i.id, i]));
      // 25/11 (medida de uso): tolerant extra read; before the migration nothing is added
      const usos = await lerUnidadesDeUso(produtoId!);
      const med = usos ? await lerMedidasDosIngredientes([...porId.keys()]) : null;
      return linhas.flatMap((l) => {
        const i = porId.get(l.ingredient_id);
        return i ? [{
          id: i.id, nome: i.name, preco: i.cost_per_unit, estoque: i.stock_quantity,
          // a per-unit line shows what he typed per unit (the batch quantity is that × the yield)
          ...(l.base === "unidade" && l.qtd_por_unidade != null ? { qtd: l.qtd_por_unidade, por: "unidade" as const } : { qtd: l.quantity, ...(l.base ? { por: l.base } : {}) }),
          unidade: unidadeDe(i.unit), pacote: i.pacote_qtd > 0 ? i.pacote_qtd : 1, ...(l.aprender ? { aprender: true } : {}),
          ...(usos && med ? { unidadeUso: usos.get(`-:${i.id}`) ?? null, conteudo: med.get(i.id)?.conteudo ?? null, embalagem: med.get(i.id)?.embalagem ?? null } : {}),
        }] : [];
      });
    },
  });
}

