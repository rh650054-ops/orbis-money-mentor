import { describe, expect, it } from "vitest";
import { comGastosBanco } from "./gastos-banco";
import { relatorioExemplo } from "./exemplo";

describe("gastos pelo banco", () => {
  it("troca mercadoria/transporte/alimentação pelo banco, mantém outros e refaz gastos e sobrou", () => {
    const rel = relatorioExemplo();
    const r = comGastosBanco(rel, { mercadoria: 1563.2, transporte: 9.1, alimentacao: 46.68 }, null);
    const d = r.atual.dinheiro;
    expect(d.mercadoria).toBe(1563.2);
    expect(d.gastos).toBeCloseTo(1563.2 + 9.1 + 46.68 + rel.atual.dinheiro.outros, 2);
    expect(d.sobrou).toBeCloseTo(d.caiu - d.gastos, 2);
    expect(r.anterior).toBe(rel.anterior); // sem dado do banco: fica como estava
  });
  it("sem banco não mexe em nada", () => {
    const rel = relatorioExemplo();
    expect(comGastosBanco(rel, null, null).atual).toBe(rel.atual);
  });
});
