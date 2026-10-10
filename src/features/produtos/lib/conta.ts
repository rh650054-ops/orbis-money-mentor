/* Contas do cadastro de produto (quiz). Puro: sem React, sem banco. */

export const centavos = (n: number) => Math.round(n * 100) / 100;

/** Pacote de R$ 22,40 com 16 → R$ 1,40 cada. Leva de R$ 48 que rende 30 → R$ 1,60. */
export function custoPorUnidade(total: number, quantidade: number): number {
  if (!(total > 0) || !(quantidade > 0)) return 0;
  return centavos(total / quantidade);
}

export interface Lucro {
  /** quanto sobra em cada venda (pode ser negativo) */
  sobra: number;
  /** % do preço que é lucro (0–100, arredondado) */
  pct: number;
}

export function lucroDe(preco: number, custo: number): Lucro {
  if (!(preco > 0)) return { sobra: 0, pct: 0 };
  const sobra = centavos(preco - Math.max(0, custo));
  return { sobra, pct: Math.round((sobra / preco) * 100) };
}

/** "E se você cobrar…": o preço dele e um degrau abaixo e acima (R$ 0,50 ou R$ 1). */
export function precosVizinhos(preco: number): number[] {
  if (!(preco > 0)) return [];
  const passo = preco >= 10 ? 1 : 0.5;
  return [centavos(Math.max(passo, preco - passo)), centavos(preco), centavos(preco + passo)];
}

const EMOJIS: [RegExp, string][] = [
  [/trufa|brigadeiro|bombom|chocolate|choco/i, "🍫"],
  [/bala|mentos|chiclete|pirulito|goma/i, "🍬"],
  [/batida|shake|suco|vitamina|milk/i, "🥤"],
  [/refri|coca|guaran|lata/i, "🥫"],
  [/[aá]gua/i, "💧"],
  [/cerveja|chopp/i, "🍺"],
  [/salgad|coxinha|pastel|esfiha|empada/i, "🥟"],
  [/bolo|torta|doce|pudim|brownie/i, "🍰"],
  [/pipoca/i, "🍿"],
  [/sorvete|picol|gelad/i, "🍦"],
  [/caf[eé]/i, "☕"],
  [/fruta|morango|uva|abacaxi|manga/i, "🍓"],
];

export function emojiDoNome(nome: string): string {
  const n = nome.trim();
  for (const [re, e] of EMOJIS) if (re.test(n)) return e;
  return "📦";
}

/** Atalhos do passo 1 (o que mais aparece na rua). */
export const SUGESTOES_NOME = [
  "Mentos", "Bala", "Chocolate", "Refrigerante", "Água", "Trufa", "Batida", "Salgado",
] as const;

export interface ItemLista { id: string; sale_price: number; cost: number; open_price?: boolean | null }

/** Mais lucrativo no topo; preço livre e sem custo vão pro fim. */
export function ordenarPorLucro<T extends ItemLista>(itens: T[]): T[] {
  const chave = (p: T) => (p.open_price || !(p.sale_price > 0) ? -Infinity : lucroDe(p.sale_price, p.cost).sobra);
  return [...itens].sort((a, b) => chave(b) - chave(a));
}
