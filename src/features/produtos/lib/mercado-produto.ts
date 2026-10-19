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

/** Quanto de cada item vai em UMA receita, sugerido pela compra: se a compra dá `unidades`
 *  e uma receita rende `rende`, a compra são unidades/rende receitas. */
export function sugestaoPorReceita(qtdComprada: number, unidades: number, rende: number): number {
  if (!(unidades > 0) || !(rende > 0) || !(qtdComprada > 0)) return 0;
  return Math.round((qtdComprada * rende / unidades) * 100) / 100;
}

/** 1ª compra de um produto sem receita, do jeito do Rick (19/10): "dá pra fazer 100",
 *  "uma receita rende 6", "numa receita vai 1 leite condensado, 1 creme de leite…".
 *  A receita guardada é a de UM lote: rende `rende` e leva `porReceita` de cada item
 *  (sem resposta, usa a sugestão proporcional à compra). */
export function receitaPorLote(
  pid: string, unidades: number, rende: number, linhasEmUn: LinhaMercado[], porReceita: Record<string, number>,
): NovaReceita | null {
  if (!(rende >= 1)) return null;
  const itens = linhasEmUn
    .filter((l) => l.qtd > 0 && (l.tipo === "ingrediente" || l.tipo === "novo"))
    .map((l) => ({
      ...(l.tipo === "ingrediente" && l.id ? { id: l.id } : {}),
      nome: l.nome.trim(),
      qtd: porReceita[l.key] && porReceita[l.key]! > 0 ? porReceita[l.key]! : sugestaoPorReceita(l.qtd, unidades, rende),
      preco: l.precoUnit ?? 0,
    }))
    .filter((i) => i.qtd > 0);
  if (itens.length === 0) return null;
  return { produto: pid, rende: Math.round(rende), itens };
}

/** 1ª compra de um produto sem receita: o que ele comprou rende `unidades` → isso É a receita. */
export function receitaDaCompra(pid: string, unidades: number, linhasEmUn: LinhaMercado[]): NovaReceita | null {
  const itens = linhasEmUn
    .filter((l) => l.qtd > 0 && (l.tipo === "ingrediente" || l.tipo === "novo"))
    .map((l) => ({ ...(l.tipo === "ingrediente" && l.id ? { id: l.id } : {}), nome: l.nome.trim(), qtd: l.qtd, preco: l.precoUnit ?? 0 }));
  if (!(unidades >= 1) || itens.length === 0) return null;
  return { produto: pid, rende: Math.round(unidades), itens };
}

/** Desconto no caixa (Rick, 19/10: "clube do Atacadão deu R$ 40"): reparte o desconto
 *  entre os itens na proporção do que cada um custou, pra o custo de cada produto já
 *  sair com o desconto. Nunca deixa preço negativo. */
export function aplicarDesconto<T extends { qtd: number; preco_unit: number | null }>(itens: T[], total: number, desconto: number): T[] {
  if (!(desconto > 0) || !(total > 0)) return itens;
  const fator = Math.max(0, (total - Math.min(desconto, total)) / total);
  return itens.map((i) => (i.preco_unit != null && i.preco_unit > 0
    ? { ...i, preco_unit: Math.round(i.preco_unit * fator * 10000) / 10000 }
    : i));
}

/** Compra salva (na unidade de medida, como foi pro banco) → linhas da tela de novo,
 *  em pacotes. Item digitado à mão ("novo") que já virou ingrediente volta como ele. */
export function linhasDaCompra(
  itens: { tipo: "ingrediente" | "produto" | "novo"; id: string | null; nome: string; qtd: number; preco_unit: number | null; para: string[] }[],
  base: BaseMercado,
): Omit<LinhaMercado, "key">[] {
  return itens.filter((i) => i.qtd > 0).map((i) => {
    const ing = i.tipo === "produto" ? undefined
      : base.ingredientes.find((x) => (i.id && x.id === i.id) || (!i.id && x.name.trim().toLowerCase() === i.nome.trim().toLowerCase()));
    if (i.tipo === "produto") return { tipo: "produto" as const, id: i.id, nome: i.nome, qtd: i.qtd, precoUnit: i.preco_unit, para: [] };
    if (!ing) return { tipo: "novo" as const, id: null, nome: i.nome, qtd: i.qtd, precoUnit: i.preco_unit, para: [] };
    const pac = Math.max(ing.pacote_qtd ?? 1, 1);
    return {
      tipo: "ingrediente" as const, id: ing.id, nome: ing.name,
      qtd: Math.round((i.qtd / pac) * 1000) / 1000,
      precoUnit: i.preco_unit != null ? Math.round(i.preco_unit * pac * 100) / 100 : null,
      para: i.para,
    };
  });
}
