import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";

/* Cadastro de 1 minuto (Rick, 29/10/2026): "Quanto é seu?" at the end of the DEFCON.
   Creates the product with name, price and a cost guess — or just fills the cost of the
   product he already has. The recipe (exact cost) stays for later, on the product page. */
export type CustoRapido = { produtoId?: string; nome: string; preco: number; custo: number };

export function useCustoRapidoMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: CustoRapido): Promise<string> => {
      if (!userId) throw new Error("sem_login");
      if (r.produtoId) {
        const { error } = await supabase.from("products").update({ cost: r.custo }).eq("id", r.produtoId);
        if (error) throw error;
        return r.produtoId;
      }
      const { data, error } = await supabase.from("products")
        .insert({ user_id: userId, name: r.nome.trim(), emoji: "📦", sale_price: r.preco, cost: r.custo, controla_estoque: false, stock_quantity: 0 })
        .select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: produtosKeys.all });
      void qc.invalidateQueries({ queryKey: ["objetivo-lucro"] });
    },
  });
}
