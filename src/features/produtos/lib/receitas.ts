/* "Não sei quanto gasto": ingredientes que costumam ir em cada tipo de produto.
   O vendedor só ajusta o que pagou. Nada aqui vira estoque de ingrediente. */

export interface IngredienteRascunho { nome: string; preco: number; usa: boolean }

const BASE: [RegExp, string[]][] = [
  [/trufa|brigadeiro|bombom|chocolate|doce/i, ["Chocolate", "Leite condensado", "Creme de leite", "Embalagem / forminha"]],
  [/batida|shake|vitamina|milk|suco/i, ["Leite condensado", "Fruta / polpa", "Bebida / leite", "Copo e canudo"]],
  [/salgad|coxinha|pastel|esfiha|empada/i, ["Farinha", "Recheio", "Óleo", "Embalagem"]],
  [/bolo|torta|pudim|brownie/i, ["Farinha", "Ovos", "Açúcar", "Chocolate / cobertura", "Embalagem"]],
];

export function ingredientesSugeridos(nomeProduto: string): IngredienteRascunho[] {
  const achou = BASE.find(([re]) => re.test(nomeProduto));
  const nomes = achou ? achou[1] : ["Ingrediente principal", "Embalagem"];
  return nomes.map((nome) => ({ nome, preco: 0, usa: true }));
}

export function totalDaReceita(itens: IngredienteRascunho[]): number {
  return Math.round(itens.filter((i) => i.usa).reduce((s, i) => s + (i.preco > 0 ? i.preco : 0), 0) * 100) / 100;
}
