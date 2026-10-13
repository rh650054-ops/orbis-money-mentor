/* Ficha completa do produto (Rick, 12/10/2026: "quando eu cadastro o produto tem que
   aparecer a tela da terceira foto"). Tudo de um produto numa tela só: preço e combos,
   como consegue (compra pronto / faz com receita), custo, estoque. Puro: sem React. */
import type { IngredienteDaReceita } from "../api/use-receita-query";
import type { ProdutoComFaixas } from "../types";
import { custoPorUnidade } from "./conta";
import { receitaDoRascunho, totalDaReceita, type IngredienteRascunho } from "./receitas";

export interface Ficha {
  nome: string;
  emoji: string;
  foto: string | null;
  origem: "compra" | "faz";
  preco: number;
  precoLivre: boolean;
  combos: { qty: number; price: number }[];
  /** custo digitado (quem compra pronto, ou quem faz sem receita com preço) */
  custo: number;
  estoque: number;
  estoqueMin: number;
  controlaEstoque: boolean;
  itens: IngredienteRascunho[];
  rende: number;
}

export function fichaDe(p: ProdutoComFaixas, receita: IngredienteDaReceita[]): Ficha {
  const faz = p.origem === "faz" || receita.length > 0;
  return {
    nome: p.name, emoji: p.emoji ?? "📦", foto: p.photo_url, origem: faz ? "faz" : "compra",
    preco: p.sale_price, precoLivre: !!p.open_price,
    combos: p.faixas.filter((f) => f.qty >= 2).map((f) => ({ qty: f.qty, price: f.price })),
    custo: p.cost, estoque: p.stock_quantity, estoqueMin: p.stock_min, controlaEstoque: p.controla_estoque !== false,
    itens: receita.map((i) => ({ id: i.id, nome: i.nome, qtd: i.qtd, preco: i.preco, usa: true })),
    rende: p.batch_yield > 0 ? p.batch_yield : 20,
  };
}

/** Custo de 1 unidade que a ficha mostra: pela receita quando TODO ingrediente tem
 *  preço; senão o custo salvo (o "Tô no mercado" completa depois). */
export function custoDaFicha(f: Ficha): { valor: number; pelaReceita: boolean } {
  if (f.origem === "faz") {
    const usados = f.itens.filter((i) => i.usa && i.qtd > 0 && i.nome.trim());
    if (usados.length > 0 && usados.every((i) => i.preco > 0)) {
      return { valor: custoPorUnidade(totalDaReceita(usados), f.rende), pelaReceita: true };
    }
  }
  return { valor: f.custo, pelaReceita: false };
}

/** Combos válidos, sem repetir quantidade (o último digitado vale). */
export function combosValidos(combos: Ficha["combos"]): Ficha["combos"] {
  const porQtd = new Map<number, number>();
  for (const c of combos) if (c.qty >= 2 && c.price > 0) porQtd.set(Math.round(c.qty), c.price);
  return [...porQtd.entries()].sort((a, b) => a[0] - b[0]).map(([qty, price]) => ({ qty, price }));
}

/** Por que não dá pra salvar ainda (ou null se pode). */
export function problemaDaFicha(f: Ficha): string | null {
  if (!f.nome.trim()) return "Falta o nome do produto.";
  if (!f.precoLivre && !(f.preco > 0)) return "Falta o preço de venda (ou marque preço na hora).";
  if (f.origem === "faz" && receitaDoRascunho(f.itens).length > 0 && !(f.rende >= 1)) return "Diz quantas unidades rende uma leva.";
  return null;
}
