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

/** Um ingrediente da receita: quanto vai numa leva (na unidade de medida dele: 1 un,
 *  200 g, 20 un de canudo) e o preço de 1 dessa unidade (opcional, pode ser aproximado).
 *  `pacote` = quanto vem em cada compra (pacote de 100 canudos, lata de 800 g). */
export interface ItemReceita {
  /** id em ingredients quando já existe */
  id?: string;
  nome: string;
  qtd: number;
  preco: number;
  unidade: Unidade;
  pacote: number;
}

export const UNIDADES = ["un", "g", "kg", "ml", "l"] as const;
export type Unidade = (typeof UNIDADES)[number];
export const unidadeDe = (u: string | null | undefined): Unidade =>
  (UNIDADES as readonly string[]).includes((u ?? "").toLowerCase()) ? ((u ?? "").toLowerCase() as Unidade) : "un";

export const RASCUNHO_VAZIO: RascunhoProduto = {
  nome: "", emoji: "📦", foto: null, origem: null, custo: 0, preco: 0,
  precoLivre: false, combo: null, estoque: 0, controlaEstoque: true, receita: null, rende: 0,
};
