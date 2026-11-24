/* SABORES (Rick, 26/10/2026): um produto, uma receita BASE (vai em todos) e, em cada
   sabor, só o que muda. Custo de cada unidade do sabor = base ÷ rende + extras ÷ rende. */
import { custoPorUnidade } from "./conta";
import { precoDe1, receitaDoRascunho, totalDaReceita, type IngredienteRascunho } from "./receitas";
import type { ItemReceita } from "../types";

export interface SaborRascunho {
  id?: string;
  nome: string;
  emoji: string;
  itens: IngredienteRascunho[];
  /** 23/11: units per batch of THIS flavour; null/undefined = the product's */
  rende?: number | null;
  /** 23/11: false = own recipe only (the base does not go in); default true */
  usaBase?: boolean;
  /** 23/11: ready units the seller already has when registering (new products only) */
  estoque?: number;
  /** 24/11: the flavour's own photo (saved right away, apart from the sheet); none = the product's */
  foto?: string | null;
}

const EMOJIS: [RegExp, string][] = [
  [/morango/i, "🍓"], [/maracuj/i, "🥭"], [/manga/i, "🥭"], [/nutella|chocolate|choco|brigadeiro/i, "🍫"],
  [/lim[aã]o/i, "🍋"], [/coco/i, "🥥"], [/uva/i, "🍇"], [/banana/i, "🍌"], [/abacaxi/i, "🍍"], [/a[cç]a[ií]|mirtilo/i, "🫐"],
  [/caf[eé]|capuccino|cappuccino/i, "☕"], [/mel[aã]o|melancia/i, "🍉"], [/laranja|tangerina/i, "🍊"], [/ma[cç][aã]/i, "🍎"],
  [/p[eê]ssego|ameixa/i, "🍑"], [/cereja/i, "🍒"], [/kiwi/i, "🥝"], [/amendoim|paçoca|pacoca/i, "🥜"], [/leite ninho|ninho|baunilha/i, "🥛"],
  [/ovomaltine|oreo|biscoito|cookie/i, "🍪"], [/menta|hortel/i, "🌿"], [/caramelo|doce de leite/i, "🍮"], [/natural|puro|tradicional/i, "🥤"],
];
/** Emoji sugerido pelo nome do sabor ("Morango" → 🍓). */
export function emojiDoSabor(nome: string): string {
  return EMOJIS.find(([re]) => re.test(nome))?.[1] ?? "🥤";
}

export const novoSabor = (nome = ""): SaborRascunho => ({ nome, emoji: emojiDoSabor(nome), itens: [] });

/** The yield a flavour is made with: its own, else the product's. */
export const rendeDoSabor = (s: SaborRascunho, rende: number) => (s.rende && s.rende > 0 ? s.rende : rende);

/** Custo de 1 unidade de cada sabor: (base, se o sabor usa a base) + extras, ÷ o rendimento do sabor.
 *  Null quando falta preço. */
export function custoDoSabor(base: IngredienteRascunho[], sabor: SaborRascunho, rende: number): number | null {
  const usados = [...(sabor.usaBase === false ? [] : base), ...sabor.itens].filter((i) => i.usa && i.qtd > 0 && i.nome.trim());
  if (usados.length === 0 || usados.some((i) => precoDe1(i) <= 0)) return null;
  return custoPorUnidade(totalDaReceita(usados), rendeDoSabor(sabor, rende));
}

export interface SaborParaSalvar { id?: string; nome: string; emoji: string; itens: ItemReceita[]; rende: number | null; usaBase: boolean }

/** Só sabores com nome; extras, rendimento e "usa a base" no formato do banco. */
export function saboresParaSalvar(sabores: SaborRascunho[]): SaborParaSalvar[] {
  return sabores
    .filter((s) => s.nome.trim() !== "")
    .map((s) => ({
      ...(s.id ? { id: s.id } : {}), nome: s.nome.trim(), emoji: s.emoji || emojiDoSabor(s.nome), itens: receitaDoRascunho(s.itens),
      rende: s.rende && s.rende > 0 ? s.rende : null, usaBase: s.usaBase !== false,
    }));
}

/** Divide N unidades entre os sabores (igual, sobra pros primeiros). */
export function dividirIgual(n: number, sabores: number): number[] {
  if (sabores <= 0) return [];
  const base = Math.floor(n / sabores);
  const sobra = n - base * sabores;
  return Array.from({ length: sabores }, (_, i) => base + (i < sobra ? 1 : 0));
}

// 23/11: the same ingredient may now be in the base and in several flavours (one stock record):
// the 22/11 guard against it (ingredientesEmConflito) is gone with the per-flavour model.
