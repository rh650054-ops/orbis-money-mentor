import { describe, expect, it } from "vitest";
import { ajustarDinheiro } from "./ajustar-dinheiro-conta";

describe("ajustarDinheiro", () => {
  it("today (not reconciled): cash comes out of the launched Pix, Vendeu stays", () => {
    // Rick 01/11: 525 launched as Pix, then says 60 was cash
    const r = ajustarDinheiro({ cash: 0, pix: 525, card: 0, caiu: 525, debt: 0 }, 60);
    expect(r).toEqual({ cash: 60, pix: 465, card: 0, caiu: 525, debt: 0, vendeu: 525 });
  });

  it("reconciled day: cash reduces 'falta cair', Vendeu stays", () => {
    const r = ajustarDinheiro({ cash: 0, pix: 205, card: 0, caiu: 205, debt: 320 }, 60);
    expect(r).toEqual({ cash: 60, pix: 205, card: 0, caiu: 265, debt: 260, vendeu: 525 });
  });

  it("lowering cash moves the difference back to 'falta cair'", () => {
    const r = ajustarDinheiro({ cash: 60, pix: 205, card: 0, caiu: 265, debt: 260 }, 0);
    expect(r).toEqual({ cash: 0, pix: 205, card: 0, caiu: 205, debt: 320, vendeu: 525 });
  });

  it("Vendeu only grows when cash alone is bigger than the day's sales", () => {
    const r = ajustarDinheiro({ cash: 0, pix: 100, card: 0, caiu: 100, debt: 0 }, 150);
    expect(r).toEqual({ cash: 150, pix: 0, card: 0, caiu: 150, debt: 0, vendeu: 150 });
  });

  it("takes from Pix before card", () => {
    const r = ajustarDinheiro({ cash: 0, pix: 50, card: 100, caiu: 150, debt: 0 }, 80);
    expect(r).toEqual({ cash: 80, pix: 0, card: 70, caiu: 150, debt: 0, vendeu: 150 });
  });
});
