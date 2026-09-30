import { describe, expect, it } from "vitest";
import { lerValor, moeda, projetar } from "./caixa-fmt";

describe("caixa-fmt", () => {
  it("lê valores digitados do jeito brasileiro", () => {
    expect(lerValor("82,50")).toBe(82.5);
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("R$ 544,16")).toBe(544.16);
    expect(lerValor("15")).toBe(15);
    expect(lerValor("abc")).toBe(0);
  });

  it("formata moeda com sinal", () => {
    expect(moeda(461.66)).toBe("R$ 461,66");
    expect(moeda(-82.5)).toBe("− R$ 82,50");
    expect(moeda(1234.4, true)).toBe("R$ 1.234");
  });

  it("projeta o saldo: churn tira, novos entram, cada ativo rende o líquido", () => {
    const p = projetar({ saldo: 461.66, ativos: 67, liquido: 24.45, novos: 20, churn: 12, gastoMes: 500 });
    // mês 1: round(67 × 0,88) + 20 = 79 ativos → 461,66 + 79 × 24,45 − 500
    expect(p.serie[1]).toBeCloseTo(461.66 + 79 * 24.45 - 500, 2);
    expect(p.serie).toHaveLength(4);
    expect(p.ativos).toBeGreaterThan(67);
  });
});
