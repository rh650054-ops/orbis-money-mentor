import { describe, expect, it } from "vitest";
import { passoDigitacao, unidadesDigitacao } from "./digitando";

describe("digitando", () => {
  it("junta as unidades e volta o texto original, sem perder espaço nem quebra de linha", () => {
    const t = "Fechou!\n\nVou fazer um esboço  agora.";
    expect(unidadesDigitacao(t).join("")).toBe(t);
  });

  it("marcador de imagem é uma unidade só (nunca aparece pela metade)", () => {
    const t = "Olha o esboço:\n[[adesivo:https://x.supabase.co/a.png]]\nO que você mudaria?";
    const u = unidadesDigitacao(t);
    expect(u).toContain("[[adesivo:https://x.supabase.co/a.png]]");
    expect(u.join("")).toBe(t);
    for (let i = 0; i <= u.length; i++) {
      const parcial = u.slice(0, i).join("");
      expect(/\[\[adesivo:(?![^\]]*\]\])/.test(parcial)).toBe(false);
    }
  });

  it("resposta longa acelera pra caber no teto de tempo", () => {
    expect(passoDigitacao(20)).toBe(1);
    const total = 600;
    const passo = passoDigitacao(total, 40, 2600);
    expect(Math.ceil(total / passo) * 40).toBeLessThanOrEqual(2600);
  });
});
