import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { marcarPasso } from "@/components/jornada/useJornada";
import { emitMissionEvent } from "@/shared/lib/missionEvents";
import type { RascunhoProduto } from "../types";
import { produtosKeys } from "./use-produtos-query";

/** Salva o produto do quiz (novo ou editado) e o combo dele. Devolve o id.
 *  Na edição, estoque e custo só são gravados se ele mexeu: o Foco e as compras
 *  mudam esses números enquanto a tela está aberta. */
export function useSalvarProdutoMutation(userId: string | undefined, inicial?: RascunhoProduto) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: RascunhoProduto): Promise<string> => {
      if (!userId) throw new Error("sem_login");
      const editando = !!(r.id && inicial);
      const mexeuEstoque = !editando || r.estoque !== inicial!.estoque || (r.controlaEstoque && !inicial!.controlaEstoque);
      const mexeuCusto = !editando || Math.abs(r.custo - inicial!.custo) >= 0.005;
      const linha = {
        user_id: userId,
        name: r.nome.trim(),
        emoji: r.emoji,
        photo_url: r.foto,
        origem: r.origem,
        sale_price: r.precoLivre ? 0 : r.preco,
        open_price: r.precoLivre,
        controla_estoque: r.controlaEstoque,
        ...(mexeuCusto ? { cost: r.custo } : {}),
        // "não controlo estoque" não apaga a contagem (se ele voltar a controlar, ela está lá)
        ...(r.controlaEstoque && mexeuEstoque ? { stock_quantity: Math.max(0, Math.round(r.estoque)) } : {}),
        ...(!editando && !r.controlaEstoque ? { stock_quantity: 0 } : {}),
      };
      const salvo = r.id
        ? await supabase.from("products").update(linha).eq("id", r.id).select("id").single()
        : await supabase.from("products").insert(linha).select("id").single();
      if (salvo.error) throw salvo.error;
      const id = salvo.data.id;
      // combo: o quiz cuida de UM combo; os outros (se ele tinha) ficam como estão.
      // Se o combo de antes mudou de quantidade, saiu ou virou preço livre, tira o velho
      // (senão o Foco continua casando o preço antigo e baixa a quantidade errada).
      const velho = editando ? inicial!.combo : null;
      if (velho && (r.precoLivre || !r.combo || r.combo.qty !== velho.qty || !(r.combo.price > 0))) {
        const { error } = await supabase.from("product_price_tiers").delete().eq("product_id", id).eq("qty", velho.qty);
        if (error) throw error;
      }
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
