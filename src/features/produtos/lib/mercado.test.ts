import { describe, expect, it } from "vitest";
import {
  calcularMercado, itensParaRpc, totaisDasLinhas,
  type BaseMercado, type IngredienteMercado, type LinhaMercado, type ProdutoMercado,
} from "./mercado";

const ing = (id: string, stock = 0, cost = 0): IngredienteMercado => ({ id, name: id, unit: "un", stock_quantity: stock, cost_per_unit: cost });
const lote = (id: string, batch_yield: number, cost = 0): ProdutoMercado => ({
  id, name: id, emoji: null, cost, stock_quantity: 0, recipe_mode: "batch", batch_yield, origem: "faz",
});
const pronto = (id: string, cost = 0): ProdutoMercado => ({ ...lote(id, 0, cost), recipe_mode: "none", origem: "compra" });
let n = 0;
const linha = (id: string, qtd: number, extra: Partial<LinhaMercado> = {}): LinhaMercado =>
  ({ key: `k${n++}`, tipo: "ingrediente", id, nome: id, qtd, precoUnit: null, para: [], ...extra });

const batida: BaseMercado = {
  ingredientes: [ing("Leite condensado"), ing("Creme de leite")],
  receitas: [
    { product_id: "Batida", ingredient_id: "Leite condensado", quantity: 1 },
    { product_id: "Batida", ingredient_id: "Creme de leite", quantity: 1 },
  ],
  produtos: [lote("Batida", 20)],
};

describe("calcularMercado", () => {
  it("57 LC + 57 CL -> 57 receitas, 1.140 batidas", () => {
    const r = calcularMercado([linha("Leite condensado", 57), linha("Creme de leite", 57)], batida);
    expect(r.produtos).toEqual([{ id: "Batida", nome: "Batida", receitas: 57, unidades: 1140, faltam: [] }]);
    expect(r.pendentes).toEqual([]);
  });

  it("splits a shared ingredient evenly and asks 'pra qual produto?' until chosen", () => {
    const base: BaseMercado = {
      ingredientes: [ing("LC"), ing("CL"), ing("Choc")],
      receitas: [
        { product_id: "Batida", ingredient_id: "LC", quantity: 1 }, { product_id: "Batida", ingredient_id: "CL", quantity: 1 },
        { product_id: "Trufa", ingredient_id: "LC", quantity: 1 }, { product_id: "Trufa", ingredient_id: "Choc", quantity: 2 },
      ],
      produtos: [lote("Batida", 20), lote("Trufa", 30)],
    };
    const lc = linha("LC", 10);
    expect(calcularMercado([lc], base).pendentes).toEqual([lc.key]);
    const r = calcularMercado([{ ...lc, para: ["Batida", "Trufa"] }, linha("CL", 5), linha("Choc", 10)], base);
    expect(r.pendentes).toEqual([]);
    expect(r.produtos.map((p) => [p.id, p.receitas, p.unidades])).toEqual([["Batida", 5, 100], ["Trufa", 5, 150]]);
  });

  it("uses existing ingredient stock (pool) and doesn't reuse it twice", () => {
    const base = { ...batida, ingredientes: [ing("Leite condensado"), ing("Creme de leite", 100)] };
    expect(calcularMercado([linha("Leite condensado", 57)], base).produtos[0]?.receitas).toBe(57);
    const dois: BaseMercado = {
      ingredientes: [ing("A"), ing("B"), ing("Pool", 3)],
      receitas: [
        { product_id: "P1", ingredient_id: "A", quantity: 1 }, { product_id: "P1", ingredient_id: "Pool", quantity: 1 },
        { product_id: "P2", ingredient_id: "B", quantity: 1 }, { product_id: "P2", ingredient_id: "Pool", quantity: 1 },
      ],
      produtos: [lote("P1", 10), lote("P2", 10)],
    };
    const r = calcularMercado([linha("A", 2), linha("B", 5)], dois);
    expect(r.produtos.map((p) => p.receitas)).toEqual([2, 1]);
  });

  it("missing ingredient -> 0 receitas with a hint", () => {
    const r = calcularMercado([linha("Leite condensado", 10)], batida);
    expect(r.produtos[0]).toMatchObject({ receitas: 0, unidades: 0, faltam: ["Creme de leite"] });
  });

  it("bought-ready products just add units", () => {
    const base = { ...batida, produtos: [...batida.produtos, pronto("Água")] };
    const r = calcularMercado([linha("Água", 24, { tipo: "produto" }), linha("Água", 6, { tipo: "produto" })], base);
    expect(r.prontos).toEqual([{ id: "Água", nome: "Água", unidades: 30 }]);
  });
});

describe("totaisDasLinhas", () => {
  const base: BaseMercado = { ingredientes: [ing("LC", 0, 5), ing("CL", 0, 3), ing("A"), ing("B"), ing("C")], receitas: [], produtos: [pronto("Água")] };
  it("item por item: qtd x preço, no price = 0", () => {
    expect(totaisDasLinhas([linha("LC", 10, { precoUnit: 6 }), linha("CL", 3)], true, null, base)).toEqual([60, 0]);
  });
  it("só o total: by qtd x current cost, remainder on last line", () => {
    const ls = [linha("LC", 10), linha("CL", 10), linha("Água", 24, { tipo: "produto" })];
    expect(totaisDasLinhas(ls, false, 100, base)).toEqual([62.5, 37.5, 0]);
  });
  it("só o total with zero costs: by qty, cents on the last", () => {
    expect(totaisDasLinhas([linha("A", 1), linha("B", 1), linha("C", 1)], false, 10, base)).toEqual([3.33, 3.33, 3.34]);
  });
});

describe("itensParaRpc", () => {
  it("sends the effective 'para' and drops price in 'só o total'", () => {
    const [it] = itensParaRpc([linha("Leite condensado", 57, { precoUnit: 6 })], false, batida);
    expect(it).toMatchObject({ tipo: "ingrediente", qtd: 57, preco_unit: null, para: ["Batida"] });
  });
});

import { emUnidades } from "./mercado";

describe("pacotes no Tô no mercado (Rick, 13/10)", () => {
  it("2 pacotes de 100 canudos por R$ 8 = 200 canudos a R$ 0,08", () => {
    const base = {
      ingredientes: [{ id: "c", name: "Canudo", unit: "un", stock_quantity: 0, cost_per_unit: 0, pacote_qtd: 100 }],
      receitas: [], produtos: [],
    };
    const [l] = [emUnidades({ key: "k", tipo: "ingrediente", id: "c", nome: "Canudo", qtd: 2, precoUnit: 8, para: [] }, base)];
    expect(l?.qtd).toBe(200);
    expect(l?.precoUnit).toBeCloseTo(0.08);
    const solto = emUnidades({ key: "k", tipo: "produto", id: "x", nome: "Água", qtd: 2, precoUnit: 3, para: [] }, base);
    expect(solto.qtd).toBe(2);
  });
});
