/* A receita de quem "faz": o que vai numa leva, quanto de cada um e quanto rende.
   Desde 13/10/2026 a receita é SALVA (ingredients + product_recipes, modo lote):
   é ela que faz o "Tô no mercado" saber que 57 leite condensado = 57 receitas. */
import type { ItemReceita } from "../types";

export interface IngredienteRascunho { nome: string; qtd: number; preco: number; usa: boolean; id?: string }

const BASE: [RegExp, string[]][] = [
  [/trufa|brigadeiro|bombom|chocolate|doce/i, ["Chocolate", "Leite condensado", "Creme de leite", "Embalagem / forminha"]],
  [/batida|shake|vitamina|milk|suco/i, ["Leite condensado", "Creme de leite", "Fruta / polpa", "Copo e canudo"]],
  [/salgad|coxinha|pastel|esfiha|empada/i, ["Farinha", "Recheio", "Óleo", "Embalagem"]],
  [/bolo|torta|pudim|brownie/i, ["Farinha", "Ovos", "Açúcar", "Chocolate / cobertura", "Embalagem"]],
];

/** Embalagem vai 1 por unidade: numa leva que rende 20, vão 20 copos. */
export const ehEmbalagem = (nome: string) => /copo|canudo|embalage|forminha|saquinho|pote|tampa/i.test(nome);

export function ingredientesSugeridos(nomeProduto: string, rende = 20): IngredienteRascunho[] {
  const achou = BASE.find(([re]) => re.test(nomeProduto));
  const nomes = achou ? achou[1] : ["Ingrediente principal", "Embalagem"];
  return nomes.map((nome) => ({ nome, qtd: ehEmbalagem(nome) ? rende : 1, preco: 0, usa: true }));
}

/** Quanto custa UMA leva: soma qtd × preço de 1 do que ele marcou. */
export function totalDaReceita(itens: Pick<IngredienteRascunho, "qtd" | "preco" | "usa">[]): number {
  const soma = itens.filter((i) => i.usa).reduce((s, i) => s + (i.preco > 0 && i.qtd > 0 ? i.qtd * i.preco : 0), 0);
  return Math.round(soma * 100) / 100;
}

/** O que vai pro banco: só o marcado, com nome e quantidade. */
export function receitaDoRascunho(itens: IngredienteRascunho[]): ItemReceita[] {
  return itens
    .filter((i) => i.usa && i.nome.trim() !== "" && i.qtd > 0)
    .map((i) => ({ ...(i.id ? { id: i.id } : {}), nome: i.nome.trim(), qtd: i.qtd, preco: i.preco }));
}

/** Volta da receita salva pro rascunho editável. */
export function rascunhoDaReceita(r: ItemReceita[]): IngredienteRascunho[] {
  return r.map((i) => ({ ...(i.id ? { id: i.id } : {}), nome: i.nome, qtd: i.qtd, preco: i.preco, usa: true }));
}

/** Quantas leves dá pra fazer com o estoque de ingredientes (a menor de todas). */
export function levasPossiveis(receita: { qtd: number; estoque: number }[]): number {
  const contas = receita.filter((i) => i.qtd > 0).map((i) => Math.floor(Math.max(0, i.estoque) / i.qtd + 1e-9));
  return contas.length ? Math.min(...contas) : 0;
}
