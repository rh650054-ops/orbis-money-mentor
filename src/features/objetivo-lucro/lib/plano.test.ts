import { describe, expect, it } from "vitest";
import { diasSugeridos, nomeUnidade, planoLucro } from "./plano";
import type { BaseLucro } from "../types";

// Rick's real 60 days (27/10/2026), rounded.
const rick: BaseLucro = {
  janela_dias: 60, dias_vendidos: 38, unidades: 807, unid_dia: 21.2, recorde_dia: 76, ticket: 22.92,
  custo_unid: 8.98, custo_receita: 5.68, custo_extrato: 8.98, gastos_corre: 7246.78,
  fonte_custo: "extrato", banco: true, estoque: 125, produto_nome: "Batida", frequencia: 0.633,
};

describe("planoLucro", () => {
  it("R$ 5.000 in 15 days working his usual 9 days needs 40 per day", () => {
    const dias = diasSugeridos(rick, 15);
    expect(dias).toBe(9);
    const p = planoLucro(rick, 5000, dias);
    expect(Math.round(p.lucroUnid * 100) / 100).toBe(13.94);
    expect(p.unidDia).toBe(40);
    expect(Math.round(p.projecao)).toBe(2660);
    expect(p.nivel).toBe("puxado");
    expect(p.produzir).toBe(40 * 9 - 125);
  });

  it("working all 15 days the goal is close to his average", () => {
    const p = planoLucro(rick, 5000, 15);
    expect(p.unidDia).toBe(24);
    expect(p.diasNaMedia).toBe(17);
  });

  it("above the record is flagged", () => {
    expect(planoLucro(rick, 20000, 9).nivel).toBe("acima");
  });

  it("no history: uses all days and has no level", () => {
    const novo = { ...rick, dias_vendidos: 0, unid_dia: 0, recorde_dia: 0, frequencia: 0 };
    expect(diasSugeridos(novo, 15)).toBe(15);
    expect(planoLucro(novo, 1000, 15).nivel).toBe("sem-historico");
  });
});

describe("nomeUnidade", () => {
  it("pluralizes the single product name", () => {
    expect(nomeUnidade("Batida")).toBe("batidas");
    expect(nomeUnidade("Batida", 1)).toBe("batida");
    expect(nomeUnidade(null)).toBe("unidades");
  });
});
