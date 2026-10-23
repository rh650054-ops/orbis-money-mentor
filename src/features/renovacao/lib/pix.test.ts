import { describe, it, expect } from "vitest";
import { venceTexto, reais } from "./pix";

describe("renovação Pix (23/10/2026)", () => {
  const agora = new Date(2026, 9, 23, 10, 0);
  it("fala em dias", () => {
    expect(venceTexto(new Date(2026, 9, 23, 21, 0).toISOString(), agora)).toBe("vence hoje às 21:00");
    expect(venceTexto(new Date(2026, 9, 24, 9, 0).toISOString(), agora)).toBe("vence amanhã");
    expect(venceTexto(new Date(2026, 9, 28, 9, 0).toISOString(), agora)).toBe("vence dia 28/10");
  });
  it("formata reais", () => expect(reais(29.9)).toBe("R$ 29,90"));
});
