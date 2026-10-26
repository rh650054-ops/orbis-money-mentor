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
/** Volta do banco: "dá pra" = pacote × rende ÷ qtd (1000 g numa leva de 100 com pacote 1000 → dá pra 100). */
export function daPraDaQtd(i: Pick<IngredienteRascunho, "pacote" | "qtd">, rende: number): number | undefined {
  if (!(i.qtd > 0) || !(rende > 0)) return undefined;
  return Math.round(((i.pacote > 0 ? i.pacote : 1) * rende / i.qtd) * 100) / 100;
}
/** Leva = o maior "dá pra" (quem compra leite em pó pra 100 define a leva de 100). */
export function rendePelosDaPra(itens: IngredienteRascunho[], atual: number): number {
  const ns = itens.filter((i) => i.usa && i.daPra && i.daPra > 0).map((i) => i.daPra as number);
  return ns.length ? Math.max(1, Math.round(Math.max(...ns))) : atual;
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
  // embalagem: "compro 100 por R$ X e dá pra 100"; o resto o vendedor diz pra quantas dá
  return nomes.map((nome) => ({ ...novoIngrediente(nome, ehEmbalagem(nome) ? rende : 1), ...(ehEmbalagem(nome) ? { pacote: 100, daPra: 100 } : {}) }));
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

/** O que vai pro banco: só o marcado, com nome, quantidade e como compra. */
export function receitaDoRascunho(itens: IngredienteRascunho[]): ItemReceita[] {
  return itens
    .filter((i) => i.usa && i.nome.trim() !== "" && (i.qtd > 0 || i.aprender))
    .map((i) => ({
      ...(i.id ? { id: i.id } : {}), nome: i.nome.trim(), qtd: i.aprender ? 0 : i.qtd,
      preco: Math.round(precoDe1(i) * 10000) / 10000, unidade: i.unidade, pacote: i.pacote > 0 ? i.pacote : 1,
      ...(i.aprender ? { aprender: true } : {}),
    }));
}

/** Volta da receita salva pro rascunho editável (com rende, calcula o "dá pra" de cada um). */
export function rascunhoDaReceita(r: ItemReceita[], rende?: number): IngredienteRascunho[] {
  return r.map((i) => {
    const base = {
      ...(i.id ? { id: i.id } : {}), nome: i.nome, qtd: i.qtd, unidade: i.unidade, pacote: i.pacote,
      precoPacote: Math.round(i.preco * i.pacote * 100) / 100, usa: true, ...(i.aprender ? { aprender: true } : {}),
    };
    const daPra = rende ? daPraDaQtd(base, rende) : undefined;
    return daPra ? { ...base, daPra } : base;
  });
}

/** Quantas levas dá pra fazer com o estoque de ingredientes (a menor de todas). */
export function levasPossiveis(receita: { qtd: number; estoque: number }[]): number {
  const contas = receita.filter((i) => i.qtd > 0).map((i) => Math.floor(Math.max(0, i.estoque) / i.qtd + 1e-9));
  return contas.length ? Math.min(...contas) : 0;
}
