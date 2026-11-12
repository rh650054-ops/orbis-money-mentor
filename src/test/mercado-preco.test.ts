import { describe, expect, it } from "vitest";
import { ultimosPrecos, type ItemDigitado } from "@/features/produtos/lib/mercado-preco";

const CREME = "creme";
describe("ultimosPrecos (12/11: 'Da última vez' = preço digitado na última compra)", () => {
  it("usa o preço de prateleira digitado, não o preço com o desconto do caixa repartido", () => {
    // 26/10: digitou R$ 1,89, a compra teve desconto e ficou gravado R$ 1,7433
    const compras = [{ ingredient_id: CREME, custo_unitario: 1.7433, mercado_compra_id: "c26" }];
    const dig = new Map<string, ItemDigitado[]>([["c26", [{ id: CREME, tipo: "ingrediente", preco_unit: 1.89 }]]]);
    expect(ultimosPrecos(compras, dig)[CREME]).toBe(1.89);
  });
  it("é sempre a compra MAIS RECENTE, nunca a mais barata do histórico", () => {
    const compras = [
      { ingredient_id: CREME, custo_unitario: 2.99, mercado_compra_id: "nova" },
      { ingredient_id: CREME, custo_unitario: 0.92, mercado_compra_id: "velha" },
    ];
    expect(ultimosPrecos(compras, new Map())[CREME]).toBe(2.99);
  });
  it("compra antiga sem itens digitados guardados: fica o valor gravado", () => {
    expect(ultimosPrecos([{ ingredient_id: CREME, custo_unitario: 1.7433, mercado_compra_id: "x" }], new Map())[CREME]).toBe(1.7433);
  });
  it("ignora item digitado sem preço", () => {
    const dig = new Map<string, ItemDigitado[]>([["c", [{ id: CREME, tipo: "ingrediente", preco_unit: null }]]]);
    expect(ultimosPrecos([{ ingredient_id: CREME, custo_unitario: 2.5, mercado_compra_id: "c" }], dig)[CREME]).toBe(2.5);
  });
});
