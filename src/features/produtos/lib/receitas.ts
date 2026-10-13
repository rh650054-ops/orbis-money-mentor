/* A receita de quem "faz": o que vai numa leva, quanto de cada um e quanto rende.
   Desde 13/10/2026 a receita é SALVA (ingredients + product_recipes, modo lote):
   é ela que faz o "Tô no mercado" saber que 57 leite condensado = 57 receitas.
   Cada ingrediente diz COMO é comprado (Rick, 13/10): "pacote de 100 canudos por R$ 8",
   "lata de 800 g por R$ 30", "15 maracujás por uns R$ 10" — tudo pode ser aproximado. */
import type { ItemReceita, Unidade } from "../types";

export interface IngredienteRascunho {
  id?: string;
  nome: string;
  /** quanto vai numa leva, na unidade de medida */
  qtd: number;
  unidade: Unidade;
  /** quanto vem em cada compra (1 = compra de 1 em 1) */
  pacote: number;
  /** quanto paga nessa compra (0 = não sabe ainda) */
  precoPacote: number;
  usa: boolean;
}

const BASE: [RegExp, string[]][] = [
  [/trufa|brigadeiro|bombom|chocolate|doce/i, ["Chocolate", "Leite condensado", "Creme de leite", "Embalagem / forminha"]],
  [/batida|shake|vitamina|milk|suco/i, ["Leite condensado", "Creme de leite", "Fruta / polpa", "Copo e canudo"]],
  [/salgad|coxinha|pastel|esfiha|empada/i, ["Farinha", "Recheio", "Óleo", "Embalagem"]],
  [/bolo|torta|pudim|brownie/i, ["Farinha", "Ovos", "Açúcar", "Chocolate / cobertura", "Embalagem"]],
];

/** Embalagem vai 1 por unidade: numa leva que rende 20, vão 20 copos. */
export const ehEmbalagem = (nome: string) => /copo|canudo|embalage|forminha|saquinho|pote|tampa/i.test(nome);

export const novoIngrediente = (nome = "", qtd = 1): IngredienteRascunho =>
  ({ nome, qtd, unidade: "un", pacote: 1, precoPacote: 0, usa: true });

export function ingredientesSugeridos(nomeProduto: string, rende = 20): IngredienteRascunho[] {
  const achou = BASE.find(([re]) => re.test(nomeProduto));
  const nomes = achou ? achou[1] : ["Ingrediente principal", "Embalagem"];
  return nomes.map((nome) => ({ ...novoIngrediente(nome, ehEmbalagem(nome) ? rende : 1), ...(ehEmbalagem(nome) ? { pacote: 100 } : {}) }));
}

/** Preço de 1 unidade de medida: pacote de 100 por R$ 8 → R$ 0,08 cada. */
export function precoDe1(i: Pick<IngredienteRascunho, "pacote" | "precoPacote">): number {
  return i.precoPacote > 0 && i.pacote > 0 ? i.precoPacote / i.pacote : 0;
}

/** Quanto custa UMA leva: soma qtd × preço de 1 do que ele marcou. */
export function totalDaReceita(itens: Pick<IngredienteRascunho, "qtd" | "pacote" | "precoPacote" | "usa">[]): number {
  const soma = itens.filter((i) => i.usa && i.qtd > 0).reduce((s, i) => s + i.qtd * precoDe1(i), 0);
  return Math.round(soma * 100) / 100;
}

/** O que vai pro banco: só o marcado, com nome, quantidade e como compra. */
export function receitaDoRascunho(itens: IngredienteRascunho[]): ItemReceita[] {
  return itens
    .filter((i) => i.usa && i.nome.trim() !== "" && i.qtd > 0)
    .map((i) => ({
      ...(i.id ? { id: i.id } : {}), nome: i.nome.trim(), qtd: i.qtd,
      preco: Math.round(precoDe1(i) * 10000) / 10000, unidade: i.unidade, pacote: i.pacote > 0 ? i.pacote : 1,
    }));
}

/** Volta da receita salva pro rascunho editável. */
export function rascunhoDaReceita(r: ItemReceita[]): IngredienteRascunho[] {
  return r.map((i) => ({
    ...(i.id ? { id: i.id } : {}), nome: i.nome, qtd: i.qtd, unidade: i.unidade, pacote: i.pacote,
    precoPacote: Math.round(i.preco * i.pacote * 100) / 100, usa: true,
  }));
}

/** Quantas levas dá pra fazer com o estoque de ingredientes (a menor de todas). */
export function levasPossiveis(receita: { qtd: number; estoque: number }[]): number {
  const contas = receita.filter((i) => i.qtd > 0).map((i) => Math.floor(Math.max(0, i.estoque) / i.qtd + 1e-9));
  return contas.length ? Math.min(...contas) : 0;
}
