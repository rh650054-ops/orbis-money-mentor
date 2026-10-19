import { describe, it, expect } from "vitest";
import { receitaPorLote, sugestaoPorReceita } from "./mercado-produto";
import type { LinhaMercado } from "./mercado";

const linha = (key: string, nome: string, qtd: number, id: string | null = null): LinhaMercado =>
  ({ key, tipo: id ? "ingrediente" : "novo", id, nome, qtd, precoUnit: null, para: [] });

describe("receita por lote (Rick, 19/10)", () => {
  it("sugere o que vai em uma receita pela compra: 17 latas pra 100 garrafas, receita de 6 → 1,02 por receita", () => {
    expect(sugestaoPorReceita(17, 100, 6)).toBe(1.02);
    expect(sugestaoPorReceita(0, 100, 6)).toBe(0);
  });
  it("guarda a receita de UM lote com o que ele respondeu (ou a sugestão)", () => {
    const r = receitaPorLote("p1", 100, 6, [linha("a", "Leite condensado", 17, "i1"), linha("b", "Creme de leite", 17, "i2")], { a: 1 });
    expect(r).toEqual({ produto: "p1", rende: 6, itens: [
      { id: "i1", nome: "Leite condensado", qtd: 1, preco: 0 },
      { id: "i2", nome: "Creme de leite", qtd: 1.02, preco: 0 },
    ] });
  });
  it("sem rendimento por receita não inventa receita", () => {
    expect(receitaPorLote("p1", 100, 0, [linha("a", "Leite", 2)], {})).toBeNull();
  });
});

import { aplicarDesconto } from "./mercado-produto";
describe("desconto no caixa", () => {
  it("R$ 380 com R$ 40 de clube: cada item cai na mesma proporção (paga R$ 340)", () => {
    const itens = [{ qtd: 10, preco_unit: 20 }, { qtd: 6, preco_unit: 30 }, { qtd: 1, preco_unit: null }];
    const r = aplicarDesconto(itens, 380, 40);
    const pago = r.reduce((s, i) => s + i.qtd * (i.preco_unit ?? 0), 0);
    expect(Math.round(pago * 100) / 100).toBe(340);
    expect(r[2]!.preco_unit).toBeNull();
  });
  it("sem desconto não mexe; desconto maior que a compra não vira preço negativo", () => {
    const itens = [{ qtd: 1, preco_unit: 10 }];
    expect(aplicarDesconto(itens, 10, 0)).toBe(itens);
    expect(aplicarDesconto(itens, 10, 50)[0]!.preco_unit).toBe(0);
  });
});

import { linhasDaCompra } from "./mercado-produto";
describe("editar compra", () => {
  it("volta as linhas em pacotes e o item digitado vira o ingrediente salvo", () => {
    const base = { ingredientes: [
      { id: "can", name: "Canudo", unit: "un", stock_quantity: 0, cost_per_unit: 0, pacote_qtd: 100 },
      { id: "nut", name: "Nutella", unit: "un", stock_quantity: 0, cost_per_unit: 0 },
    ], receitas: [], produtos: [] };
    const r = linhasDaCompra([
      { tipo: "ingrediente", id: "can", nome: "Canudo", qtd: 200, preco_unit: 0.08, para: [] },
      { tipo: "novo", id: null, nome: "nutella ", qtd: 1, preco_unit: 55, para: [] },
    ], base);
    expect(r[0]).toMatchObject({ tipo: "ingrediente", id: "can", qtd: 2, precoUnit: 8 });
    expect(r[1]).toMatchObject({ tipo: "ingrediente", id: "nut", qtd: 1, precoUnit: 55 });
  });
});
