import { describe, expect, it } from "vitest";
import { calcularMercado, emUnidades, totaisDasLinhas, type BaseMercado, type LinhaMercado } from "./mercado";
import { compararPreco, custoDosProdutos, ingredientesDaReceita, receitaDaCompra, semReceita } from "./mercado-produto";

const base: BaseMercado = {
  ingredientes: [
    { id: "lc", name: "Leite condensado", unit: "un", stock_quantity: 0, cost_per_unit: 4.5 },
    { id: "cl", name: "Creme de leite", unit: "un", stock_quantity: 0, cost_per_unit: 2.29 },
    { id: "ca", name: "Canudo", unit: "un", stock_quantity: 0, cost_per_unit: 0.08, pacote_qtd: 100 },
  ],
  receitas: [
    { product_id: "b", ingredient_id: "lc", quantity: 1 },
    { product_id: "b", ingredient_id: "cl", quantity: 1 },
  ],
  produtos: [
    { id: "b", name: "Batida", emoji: null, cost: 0.4, stock_quantity: 0, recipe_mode: "batch", batch_yield: 10, origem: "faz", sale_price: 8 },
    { id: "t", name: "Trufa", emoji: null, cost: 0, stock_quantity: 0, recipe_mode: "none", batch_yield: 0, origem: "faz" },
  ],
  ultimos: { lc: 4.79 },
};
const linha = (p: Partial<LinhaMercado>): LinhaMercado => ({ key: "k", tipo: "ingrediente", id: "lc", nome: "x", qtd: 1, precoUnit: null, para: [], ...p });

describe("mercado pelo produto", () => {
  it("a receita do produto traz os ingredientes; produto sem receita é 1ª compra", () => {
    expect(ingredientesDaReceita("b", base).map((i) => i.id)).toEqual(["lc", "cl"]);
    expect(semReceita("b", base)).toBe(false);
    expect(semReceita("t", base)).toBe(true);
  });

  it("custo de cada unidade sai do que foi gasto com aquele produto", () => {
    const ls = [linha({ key: "a", id: "lc", qtd: 57, precoUnit: 4.99 }), linha({ key: "c", id: "cl", qtd: 57, precoUnit: 2.29 })];
    const em = ls.map((l) => emUnidades(l, base));
    const prev = calcularMercado(em, base);
    const sub = totaisDasLinhas(em, true, null, base);
    const [c] = custoDosProdutos(em, sub, prev, base);
    expect(c?.unidades).toBe(570);
    expect(c?.custo).toBeCloseTo((57 * 4.99 + 57 * 2.29) / 570, 6);
    expect(c?.antes).toBe(0.4);
    expect(c?.venda).toBe(8);
  });

  it("compara com o último preço pago (no preço do pacote)", () => {
    expect(compararPreco(linha({ precoUnit: 4.99 }), base)?.diferenca).toBeCloseTo(0.2, 6);
    const canudo = compararPreco(linha({ id: "ca", precoUnit: 7 }), base);
    expect(canudo?.antes).toBeCloseTo(8, 6);
    expect(canudo?.diferenca).toBeCloseTo(-1, 6);
    expect(compararPreco(linha({ precoUnit: null }), base)).toBeNull();
  });

  it("1ª compra vira a receita: o que comprou rende as unidades que ele disse", () => {
    const ls = [linha({ tipo: "novo", id: null, nome: " Chocolate ", qtd: 2, precoUnit: 30 }), linha({ id: "lc", nome: "Leite condensado", qtd: 3, precoUnit: 5 })];
    expect(receitaDaCompra("t", 60, ls)).toEqual({
      produto: "t", rende: 60,
      itens: [{ nome: "Chocolate", qtd: 2, preco: 30 }, { id: "lc", nome: "Leite condensado", qtd: 3, preco: 5 }],
    });
    expect(receitaDaCompra("t", 0, ls)).toBeNull();
  });
});
