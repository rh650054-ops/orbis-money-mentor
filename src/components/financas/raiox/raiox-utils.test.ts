import { describe, expect, it } from "vitest";
import { lerValor, bonito } from "./raiox-utils";

describe("lerValor", () => {
  it("entende o jeito brasileiro e o com ponto", () => {
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("2000")).toBe(2000);
    expect(lerValor("2.000")).toBe(2000);
    expect(lerValor("12,5")).toBe(12.5);
    expect(lerValor("12.50")).toBe(12.5);
    expect(lerValor("R$ 47,90")).toBe(47.9);
    expect(lerValor("")).toBe(0);
  });
});

describe("bonito", () => {
  it("deixa o nome legível", () => {
    expect(bonito("ISIS FE")).toBe("Isis Fe");
    expect(bonito(null)).toBe("");
  });
});
