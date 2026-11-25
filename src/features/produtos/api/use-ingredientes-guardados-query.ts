import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { useAuth } from "@/hooks/useAuth";
import { unidadeDe, type Unidade } from "../types";
import { produtosKeys } from "./use-produtos-query";
import { lerMedidasDosIngredientes, type MedidaDoIngrediente } from "./medidas";

const num = z.coerce.number().catch(0);
const schema = z.object({
  id: z.string(), name: z.string(), cost_per_unit: num, unit: z.string().nullable().catch("un"), pacote_qtd: z.coerce.number().catch(1),
});

export interface IngredienteGuardado extends Partial<MedidaDoIngrediente> { id: string; nome: string; unidade: Unidade; pacote: number; precoPacote: number }

/** Ingredientes que o vendedor já tem guardados (de receitas ou do "Tô no mercado"),
 *  pra receita sugerir o mesmo nome e a compra casar com a receita. */
export function useIngredientesGuardadosQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: produtosKeys.list({ tela: "ingredientes-guardados", userId: user?.id }),
    enabled: !!user?.id,
    queryFn: async (): Promise<IngredienteGuardado[]> => {
      const { data, error } = await supabase.from("ingredients").select("id, name, cost_per_unit, unit, pacote_qtd")
        .eq("user_id", user!.id).order("name");
      if (error) throw error;
      const lista = z.array(schema).parse(data ?? []);
      // 25/11: "each caixinha has 395 g" is asked once and reused by every recipe
      const med = await lerMedidasDosIngredientes(lista.map((i) => i.id));
      return lista.map((i) => {
        const pacote = i.pacote_qtd > 0 ? i.pacote_qtd : 1;
        return { id: i.id, nome: i.name, unidade: unidadeDe(i.unit), pacote, precoPacote: Math.round(i.cost_per_unit * pacote * 100) / 100, ...(med ? (med.get(i.id) ?? { conteudo: null, embalagem: null }) : {}) };
      });
    },
  });
}
