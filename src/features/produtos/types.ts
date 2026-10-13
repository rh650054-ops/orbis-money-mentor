import { z } from "zod";

const num = z.coerce.number().catch(0);

export const produtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  photo_url: z.string().nullable().catch(null),
  cost: num,
  sale_price: num,
  stock_quantity: num,
  stock_min: num,
  open_price: z.boolean().nullable().catch(false),
  recipe_mode: z.string().nullable().catch("none"),
  batch_yield: num,
  origem: z.enum(["compra", "faz"]).nullable().catch(null),
  emoji: z.string().nullable().catch(null),
  controla_estoque: z.boolean().nullable().catch(true),
});
export type Produto = z.infer<typeof produtoSchema>;

export const faixaSchema = z.object({ product_id: z.string(), qty: num, price: num });
export type Faixa = z.infer<typeof faixaSchema>;

export interface ProdutoComFaixas extends Produto {
  faixas: { qty: number; price: number }[];
}

/** O que o quiz junta antes de salvar. */
export interface RascunhoProduto {
  id?: string;
  nome: string;
  emoji: string;
  foto: string | null;
  origem: "compra" | "faz" | null;
  custo: number;
  preco: number;
  precoLivre: boolean;
  combo: { qty: number; price: number } | null;
  estoque: number;
  controlaEstoque: boolean;
  /** "Eu mesmo faço": o que vai numa receita (leva) e quantas unidades ela rende.
   *  null = sem receita salva (custo digitado direto). */
  receita: ItemReceita[] | null;
  rende: number;
}

/** Um ingrediente da receita: quanto vai numa leva (em unidades de compra: 1 lata,
 *  2 caixas) e o preço de 1 (opcional — vem da última compra quando existe). */
export interface ItemReceita {
  /** id em ingredients quando já existe */
  id?: string;
  nome: string;
  qtd: number;
  preco: number;
}

export const RASCUNHO_VAZIO: RascunhoProduto = {
  nome: "", emoji: "📦", foto: null, origem: null, custo: 0, preco: 0,
  precoLivre: false, combo: null, estoque: 0, controlaEstoque: true, receita: null, rende: 0,
};
