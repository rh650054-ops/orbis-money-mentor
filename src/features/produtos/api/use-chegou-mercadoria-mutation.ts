import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { produtosKeys } from "./use-produtos-query";

export interface Chegada { productId: string; unidades: number; totalPago: number; estoqueAtual: number }

/** "Chegou mercadoria": soma no estoque. Com o valor pago, vira compra
 *  (compras_mercadoria) e o gatilho do banco soma o estoque e recalcula o custo
 *  médio. Não entra no custo do dia: o custo da mercadoria já é contado quando
 *  ela é vendida no Foco. */
export function useChegouMercadoriaMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Chegada) => {
      if (!userId) throw new Error("sem_login");
      if (!(c.unidades > 0)) return;
      if (c.totalPago > 0) {
        const { error } = await supabase.from("compras_mercadoria").insert({
          user_id: userId, item_tipo: "produto", product_id: c.productId,
          quantidade: c.unidades, total_pago: c.totalPago, lancar_custo_dia: false,
        });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("products")
        .update({ stock_quantity: Math.max(0, c.estoqueAtual) + Math.round(c.unidades), controla_estoque: true })
        .eq("id", c.productId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}
