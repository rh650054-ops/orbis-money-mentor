import { describe, expect, it } from "vitest";
import { telefoneNormalizado, telefoneValido } from "./telefone";

describe("telefoneValido (igual ao banco)", () => {
  it("aceita celular com DDD", () => {
    expect(telefoneValido("(11) 91505-4830")).toBe(true);
    expect(telefoneValido("+55 21 98123-4567")).toBe(true);
  });
  it("recusa o que o banco recusa", () => {
    expect(telefoneValido("11 1505-4830")).toBe(false);   // 10 dígitos (sem o 9)
    expect(telefoneValido("11 81505-4830")).toBe(false);  // não começa com 9
    expect(telefoneValido("10 91505-4830")).toBe(false);  // DDD inválido
    expect(telefoneValido("11 99999-9999")).toBe(false);  // repetido
    expect(telefoneValido("11 91234-5678")).toBe(false);  // de mentira
    expect(telefoneValido("")).toBe(false);
  });
  it("normaliza +55 e 0 na frente", () => {
    expect(telefoneNormalizado("+55 (11) 91505-4830")).toBe("11915054830");
    expect(telefoneNormalizado("5511915054830")).toBe("11915054830");
  });
});
