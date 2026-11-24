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
  /** "não sei quanto vai, descubro na compra" (26/10) */
  aprender?: boolean;
  /** 23/11: he typed the price or the purchase size on THIS screen. Only then the price is sent:
   *  a price that came from the database (e.g. a newer Market purchase) is never re-sent over itself */
  precoEditado?: boolean;
  /** 26/10 (Rick): "compro 1 kg por R$ 35,99 e dá pra 100 garrafinhas". qtd por leva = pacote × rende ÷ daPra */
  daPra?: number;
}

/** Quanto vai numa leva, pelo "dá pra N": compro 1 kg (1000 g) que dá pra 100; leva de 100 → 1000 g. */
export function qtdPorDaPra(i: Pick<IngredienteRascunho, "pacote" | "daPra">, rende: number): number {
  if (!(i.daPra && i.daPra > 0) || !(rende > 0)) return 0;
  return Math.round(((i.pacote > 0 ? i.pacote : 1) * rende / i.daPra) * 1000) / 1000;
}
/** Custo de 1 unidade do produto só por esse ingrediente: R$ 35,99 ÷ 100 = R$ 0,36. */
export function custoPorDaPra(i: Pick<IngredienteRascunho, "precoPacote" | "daPra">): number {
  return i.daPra && i.daPra > 0 && i.precoPacote > 0 ? i.precoPacote / i.daPra : 0;
}
/* 22/11 (Etapa 2): the yield ("rende") is the seller's number. It is never derived from a "dá pra"
   any more: before, the largest "dá pra" became the yield and every quantity was rescaled when a saved
   recipe was opened (saved "rende 20, 1 can" came back as "rende 100, 5 cans"). Now "dá pra" is only a
   shortcut that fills the quantity used, once; what is saved is exactly what is shown. */

/** Same ingredient written differently: case, accents, extra spaces, plural "s", punctuation.
 *  "Leite Condensado", "leite  condensado", "Leites condensados" → "leite condensado". */
export function nomeNormalizado(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)).join(" ");
}

/** An ingredient he already has that is the same one written differently (only an exact match after
 *  normalizing: "leite" never matches "leite condensado"). */
export function ingredienteIgual<T extends { nome: string }>(nome: string, guardados: T[]): T | undefined {
  const n = nomeNormalizado(nome);
  return n ? guardados.find((g) => nomeNormalizado(g.nome) === n) : undefined;
}

/** A line is a DRAFT when it has a name but no quantity used yet ("descubro depois"). */
export const ehRascunho = (i: Pick<IngredienteRascunho, "usa" | "nome" | "qtd" | "aprender">) =>
  i.usa && i.nome.trim() !== "" && (!!i.aprender || !(i.qtd > 0));

/** Complete = a yield and EVERY checked, named ingredient with a quantity (23/11: one filled line is not
 *  enough; "descubro depois" counts as missing; unchecked lines are not part of the recipe). */
export function receitaCompleta(itens: IngredienteRascunho[], rende: number): boolean {
  const ativos = itens.filter((i) => i.usa && i.nome.trim() !== "");
  return rende >= 1 && ativos.length > 0 && ativos.every((i) => !i.aprender && i.qtd > 0);
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
  ({ nome, qtd, unidade: "un", pacote: 1, precoPacote: 0, usa: true, daPra: undefined });

export function ingredientesSugeridos(nomeProduto: string, rende = 20): IngredienteRascunho[] {
  const achou = BASE.find(([re]) => re.test(nomeProduto));
  const nomes = achou ? achou[1] : ["Ingrediente principal", "Embalagem"];
  // 22/11: only NAMES are suggested; quantities start empty (nothing is invented). The packaging keeps
  // "compro 100" as a purchase size, and the seller says how many go in the batch.
  void rende;
  return nomes.map((nome) => ({ ...novoIngrediente(nome, 0), ...(ehEmbalagem(nome) ? { pacote: 100 } : {}) }));
}

/** Tamanho de compra que faz sentido ao trocar a unidade (26/10, bug do R$ 404 por garrafinha:
 *  "500 g" numa leva com "você compra 1 g por R$ 4" = R$ 2.000). g/ml → 1000; kg/l/un → 1. */
export function pacoteAoTrocarUnidade(unidade: Unidade, pacoteAtual: number, unidadeAnterior: Unidade): number {
  if (unidade === unidadeAnterior) return pacoteAtual;
  if (unidade === "g" || unidade === "ml") return pacoteAtual > 1 && (unidadeAnterior === "g" || unidadeAnterior === "ml") ? pacoteAtual : 1000;
  return 1;
}

/** Como mostrar o tamanho da compra: 1000 g vira "1 kg", 1500 ml vira "1,5 l" (26/10).
 *  O banco e a conta continuam na unidade da leva (g/ml); só a tela mostra na unidade grande. */
export type UnidadeCompra = Unidade;
export function compraNaTela(unidade: Unidade, pacote: number): { valor: number; unidade: UnidadeCompra } {
  if ((unidade === "g" || unidade === "ml") && pacote >= 1000) {
    return { valor: Math.round((pacote / 1000) * 1000) / 1000, unidade: unidade === "g" ? "kg" : "l" };
  }
  return { valor: pacote, unidade };
}
/** O que ele digitou na compra ("1 kg") de volta pra unidade da leva (1000 g). */
export function pacoteDaCompra(valor: number, unidadeCompra: UnidadeCompra, unidadeLeva: Unidade): number {
  if (unidadeLeva === "g" && unidadeCompra === "kg") return valor * 1000;
  if (unidadeLeva === "ml" && unidadeCompra === "l") return valor * 1000;
  return valor;
}
/** Unidades que fazem sentido pra compra desse ingrediente: g → g ou kg; ml → ml ou l. */
export function unidadesDeCompra(unidadeLeva: Unidade): UnidadeCompra[] {
  if (unidadeLeva === "g") return ["kg", "g"];
  if (unidadeLeva === "ml") return ["l", "ml"];
  return [unidadeLeva];
}

/** Preço de 1 g/ml acima disso é quase sempre erro de digitação (R$ 4,00 o grama). */
export function precoSuspeito(i: Pick<IngredienteRascunho, "unidade" | "pacote" | "precoPacote">): boolean {
  const p1 = precoDe1(i);
  return p1 > 0 && ((i.unidade === "g" || i.unidade === "ml") ? p1 > 0.5 : (i.unidade === "kg" || i.unidade === "l") ? p1 > 500 : false);
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

/** O que vai pro banco: só o marcado, com nome, quantidade e como compra.
 *  22/11: a line with a name but no quantity is kept as a draft ("descubro depois", aprender) instead of
 *  being dropped on save; it never counts as consumption (quantity 0), so it cannot feed production. */
export function receitaDoRascunho(itens: IngredienteRascunho[]): ItemReceita[] {
  return itens
    .filter((i) => i.usa && i.nome.trim() !== "")
    .map((i) => {
      const rascunho = ehRascunho(i);
      return {
        ...(i.id ? { id: i.id } : {}), nome: i.nome.trim(), qtd: rascunho ? 0 : i.qtd,
        // 23/11: full precision (it used to be 4 decimals: R$ 35,99/kg came back as R$ 36,00);
        // 10 decimals only drops binary float noise (35.99 / 1000 = 0.035990000000000004)
        preco: Math.round(precoDe1(i) * 1e10) / 1e10, unidade: i.unidade, pacote: i.pacote > 0 ? i.pacote : 1,
        ...(rascunho ? { aprender: true } : {}), ...(i.precoEditado ? { precoEditado: true } : {}),
      };
    });
}

/** Volta da receita salva pro rascunho editável: exatamente o que está salvo (22/11: no "dá pra" is
 *  derived any more, so opening a recipe never rescales its quantities). */
export function rascunhoDaReceita(r: ItemReceita[], _rende?: number): IngredienteRascunho[] {
  return r.map((i) => ({
    ...(i.id ? { id: i.id } : {}), nome: i.nome, qtd: i.qtd, unidade: i.unidade, pacote: i.pacote,
    precoPacote: Math.round(i.preco * i.pacote * 100) / 100, usa: true, ...(i.aprender ? { aprender: true } : {}),
    ...(i.precoEditado ? { precoEditado: true } : {}),
  }));
}

/** Quantas levas dá pra fazer com o estoque de ingredientes (a menor de todas). */
export function levasPossiveis(receita: { qtd: number; estoque: number }[]): number {
  const contas = receita.filter((i) => i.qtd > 0).map((i) => Math.floor(Math.max(0, i.estoque) / i.qtd + 1e-9));
  return contas.length ? Math.min(...contas) : 0;
}

/** Indexes of lines that are the same ingredient as an earlier line. */
export function linhasRepetidas(itens: IngredienteRascunho[]): Set<number> {
  const vistos = new Map<string, number>();
  const rep = new Set<number>();
  itens.forEach((it, i) => {
    const k = it.id ?? nomeNormalizado(it.nome);
    if (!it.usa || !k) return;
    if (vistos.has(k)) rep.add(i); else vistos.set(k, i);
  });
  return rep;
}

/* 24/11 — VANT Receita Inteligente. */

/** How a line says what it uses: the whole package, half of it, a typed amount, or "ainda não sei". */
export type AtalhoUso = "inteira" | "metade" | "informar" | "naosei";
const quase = (a: number, b: number) => Math.abs(a - b) < 1e-9;
export function atalhoDoUso(i: Pick<IngredienteRascunho, "qtd" | "pacote" | "aprender">): AtalhoUso {
  if (i.aprender) return "naosei";
  const pac = i.pacote > 0 ? i.pacote : 1;
  if (i.qtd > 0 && quase(i.qtd, pac)) return "inteira";
  if (i.qtd > 0 && quase(i.qtd, pac / 2)) return "metade";
  return "informar";
}
/** What each shortcut writes. Always in the purchase's own unit: a whole 395 g box uses 395 g, a whole
 *  "1 un" uses 1 un. Nothing is converted or invented. */
export function usoDoAtalho(a: AtalhoUso, i: Pick<IngredienteRascunho, "pacote">): Partial<IngredienteRascunho> {
  const pac = i.pacote > 0 ? i.pacote : 1;
  if (a === "inteira") return { qtd: pac, aprender: false };
  if (a === "metade") return { qtd: Math.round((pac / 2) * 1000) / 1000, aprender: false };
  if (a === "naosei") return { qtd: 0, aprender: true };
  return { aprender: false };
}

/** The live cost of a recipe. It is PARTIAL while a used line has no quantity ("ainda não sei") or no
 *  price: then the per-unit value is shown as partial, never as the final cost. */
export interface ResumoCusto { total: number; porUnidade: number; faltaQtd: string[]; faltaPreco: string[]; completo: boolean }
export function resumoDoCusto(itens: IngredienteRascunho[], rende: number): ResumoCusto {
  const ativos = itens.filter((i) => i.usa && i.nome.trim() !== "");
  const faltaQtd = ativos.filter((i) => i.aprender || !(i.qtd > 0)).map((i) => i.nome.trim());
  const faltaPreco = ativos.filter((i) => !i.aprender && i.qtd > 0 && !(precoDe1(i) > 0)).map((i) => i.nome.trim());
  const total = totalDaReceita(ativos);
  const porUnidade = rende >= 1 ? total / rende : 0;
  return { total, porUnidade, faltaQtd, faltaPreco, completo: rende >= 1 && ativos.length > 0 && faltaQtd.length === 0 && faltaPreco.length === 0 };
}
