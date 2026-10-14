/* "Tô no mercado" pensado a partir do PRODUTO (Rick, 14/10): escolhe pra qual
   produto está comprando, a receita já traz os ingredientes, e a VANT mostra o
   custo de cada unidade e se ele pagou mais caro que da última vez. Puro. */
import { ehLote, paraEfetivo, type BaseMercado, type LinhaMercado, type PreviaMercado } from "./mercado";

/** Ingredientes da receita do produto, prontos pra virar linhas da compra. */
export function ingredientesDaReceita(pid: string, base: BaseMercado): { id: string; nome: string }[] {
  const ids = base.receitas.filter((r) => r.product_id === pid && r.quantity > 0).map((r) => r.ingredient_id);
  return base.ingredientes.filter((i) => ids.includes(i.id)).map((i) => ({ id: i.id, nome: i.name }));
}

/** Produto que ele faz e ainda não tem receita: a 1ª compra ensina a receita. */
export function semReceita(pid: string, base: BaseMercado): boolean {
  const p = base.produtos.find((x) => x.id === pid);
  return !!p && !ehLote(p) && ingredientesDaReceita(pid, base).length === 0;
}

export interface CustoProduto { id: string; nome: string; unidades: number; gasto: number; custo: number; antes: number; venda: number }

/** Quanto do dinheiro desta compra foi pra cada produto e quanto sai cada unidade. */
export function custoDosProdutos(
  linhasEmUn: LinhaMercado[], subtotais: number[], previa: PreviaMercado, base: BaseMercado,
): CustoProduto[] {
  const gasto = new Map<string, number>();
  linhasEmUn.forEach((l, i) => {
    const para = paraEfetivo(l, base);
    const v = subtotais[i] ?? 0;
    for (const pid of para) gasto.set(pid, (gasto.get(pid) ?? 0) + v / para.length);
  });
  return previa.produtos.filter((p) => p.unidades > 0).map((p) => {
    const prod = base.produtos.find((x) => x.id === p.id);
    const g = gasto.get(p.id) ?? 0;
    return {
      id: p.id, nome: p.nome, unidades: p.unidades, gasto: g,
      custo: g > 0 ? g / p.unidades : 0, antes: prod?.cost ?? 0, venda: prod?.sale_price ?? 0,
    };
  });
}

export interface Comparacao { antes: number; diferenca: number; pct: number }

/** Pagou mais ou menos que da última vez? Tudo no preço do PACOTE (como ele vê na tela). */
export function compararPreco(linha: LinhaMercado, base: BaseMercado): Comparacao | null {
  if (linha.tipo !== "ingrediente" || !linha.id || !(linha.precoUnit && linha.precoUnit > 0)) return null;
  const ing = base.ingredientes.find((i) => i.id === linha.id);
  const porUn = base.ultimos?.[linha.id] ?? ing?.cost_per_unit ?? 0;
  if (!(porUn > 0)) return null;
  const antes = porUn * (ing?.pacote_qtd && ing.pacote_qtd > 1 ? ing.pacote_qtd : 1);
  const diferenca = linha.precoUnit - antes;
  return { antes, diferenca, pct: (diferenca / antes) * 100 };
}

export interface NovaReceita { produto: string; rende: number; itens: { id?: string; nome: string; qtd: number; preco: number }[] }

/** 1ª compra de um produto sem receita: o que ele comprou rende `unidades` → isso É a receita. */
export function receitaDaCompra(pid: string, unidades: number, linhasEmUn: LinhaMercado[]): NovaReceita | null {
  const itens = linhasEmUn
    .filter((l) => l.qtd > 0 && (l.tipo === "ingrediente" || l.tipo === "novo"))
    .map((l) => ({ ...(l.tipo === "ingrediente" && l.id ? { id: l.id } : {}), nome: l.nome.trim(), qtd: l.qtd, preco: l.precoUnit ?? 0 }));
  if (!(unidades >= 1) || itens.length === 0) return null;
  return { produto: pid, rende: Math.round(unidades), itens };
}
