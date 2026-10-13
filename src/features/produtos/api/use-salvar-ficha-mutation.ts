import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api";
import { combosValidos, custoDaFicha, type Ficha } from "../lib/ficha";
import { receitaDoRascunho } from "../lib/receitas";
import { salvarReceita } from "./salvar-receita";
import { produtosKeys } from "./use-produtos-query";

/** Salva a ficha inteira. Estoque só é gravado se ele mexeu (o Foco e as compras
 *  mudam esse número enquanto a tela está aberta). */
export function useSalvarFichaMutation(userId: string | undefined, produtoId: string, inicial: Ficha) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: Ficha) => {
      if (!userId) throw new Error("sem_login");
      const custo = custoDaFicha(f);
      const receita = f.origem === "faz" ? receitaDoRascunho(f.itens) : [];
      const { error } = await supabase.from("products").update({
        name: f.nome.trim(), emoji: f.emoji, photo_url: f.foto, origem: f.origem,
        sale_price: f.precoLivre ? 0 : f.preco, open_price: f.precoLivre,
        // com receita sem todos os preços, o banco mantém o custo; sem receita vale o digitado
        ...(receita.length === 0 || custo.pelaReceita ? { cost: custo.valor } : {}),
        stock_min: Math.max(0, Math.round(f.estoqueMin)), controla_estoque: f.controlaEstoque,
        ...(f.estoque !== inicial.estoque ? { stock_quantity: Math.max(0, Math.round(f.estoque)) } : {}),
      }).eq("id", produtoId);
      if (error) throw error;

      // combos: grava os novos antes de tirar os que saíram (cair no meio nunca deixa sem combo)
      const combos = f.precoLivre ? [] : combosValidos(f.combos);
      if (combos.length > 0) {
        const up = await supabase.from("product_price_tiers").upsert(
          combos.map((c) => ({ user_id: userId, product_id: produtoId, qty: c.qty, price: c.price })),
          { onConflict: "product_id,qty" });
        if (up.error) throw up.error;
      }
      // só combos (2+); a faixa de 1 un da tela antiga fica como está
      let tirar = supabase.from("product_price_tiers").delete().eq("product_id", produtoId).gte("qty", 2);
      if (combos.length > 0) tirar = tirar.not("qty", "in", `(${combos.map((c) => c.qty).join(",")})`);
      const del = await tirar;
      if (del.error) throw del.error;
      // receita: grava quando tem; tira quando ele passou a comprar pronto ou esvaziou
      const tinha = inicial.origem === "faz" && receitaDoRascunho(inicial.itens).length > 0;
      if (receita.length > 0 || tinha) await salvarReceita(produtoId, receita, f.rende);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: produtosKeys.all }),
  });
}
