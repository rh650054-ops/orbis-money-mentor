import { describe, expect, it } from "vitest";
import { naoApareceu, somaSemana, type DiaFezCaiu } from "./fez-caiu-conta";

const dia = (p: Partial<DiaFezCaiu>): DiaFezCaiu => ({ dia: "2026-10-09", fez: 0, dinheiro: 0, caiu: 0, conferido: true, ...p });

describe("fez × caiu", () => {
  it("o que não apareceu desconta o dinheiro na mão", () => {
    expect(naoApareceu(dia({ fez: 566.03, dinheiro: 65.01, caiu: 420.44 }))).toBe(80.58);
    expect(naoApareceu(dia({ fez: 100, dinheiro: 20, caiu: 90 }))).toBe(0);
  });

  it("quem não tem banco não tem 'não apareceu'", () => {
    expect(naoApareceu(dia({ fez: 300, caiu: null }))).toBe(0);
  });

  it("soma a semana: recebido = banco + dinheiro", () => {
    expect(somaSemana([dia({ fez: 200, dinheiro: 50, caiu: 120 }), dia({ fez: 100, dinheiro: 0, caiu: 100 })]))
      .toEqual({ fez: 300, recebido: 270 });
    expect(somaSemana([dia({ fez: 200, caiu: null })])).toEqual({ fez: 200, recebido: 0 });
  });
});
