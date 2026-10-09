import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { marcarPasso } from "@/components/jornada/useJornada";
import { emitMissionEvent } from "@/shared/lib/missionEvents";
import type { RascunhoProduto } from "../types";
import { produtosKeys } from "./use-produtos-query";

/** Salva o produto do quiz (novo ou editado) e o combo dele. Devolve o id. */
export function useSalvarProdutoMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: RascunhoProduto): Promise<string> => {
      if (!userId) throw new Error("sem_login");
      const linha = {
        user_id: userId,
        name: r.nome.trim(),
        emoji: r.emoji,
        photo_url: r.foto,
        origem: r.origem,
        cost: r.custo,
        sale_price: r.precoLivre ? 0 : r.preco,
        open_price: r.precoLivre,
        stock_quantity: r.controlaEstoque ? Math.max(0, Math.round(r.estoque)) : 0,
        controla_estoque: r.controlaEstoque,
      };
      const salvo = r.id
        ? await supabase.from("products").update(linha).eq("id", r.id).select("id").single()
        : await supabase.from("products").insert(linha).select("id").single();
      if (salvo.error) throw salvo.error;
      const id = salvo.data.id;
      // combo: o quiz cuida de UM combo; os outros (se ele tinha) ficam como estão
      if (r.combo && !r.precoLivre && r.combo.qty >= 2 && r.combo.price > 0) {
        const { error } = await supabase.from("product_price_tiers")
          .upsert({ user_id: userId, product_id: id, qty: r.combo.qty, price: r.combo.price }, { onConflict: "product_id,qty" });
        if (error) throw error;
      }
      if (!r.id) {
        void marcarPasso("produto"); // jornada do teste: dia 0 "cadastrar seu produto"
        emitMissionEvent("product-added");
      }
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}

/** Tira o produto da lista (o histórico de vendas continua). */
export function useApagarProdutoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}
