import { describe, expect, it } from "vitest";
import { sobraDoProduto, textoEstoque } from "./sobra";

describe("sobra do estoque depois da compra", () => {
  it("promoção: sobra leite condensado, falta leite pra próxima leva", () => {
    const s = sobraDoProduto([
      { nome: "Leite condensado", unidade: "un", pacote: 1, porLeva: 2, estoque: 47 },
      { nome: "Creme de leite", unidade: "un", pacote: 1, porLeva: 2, estoque: 47 },
      { nome: "Leite", unidade: "ml", pacote: 1000, porLeva: 2000, estoque: 0 },
    ]);
    expect(s.levasPossiveis).toBe(0);
    expect(s.faltam).toEqual(["Leite"]);
    expect(s.sobras[0]).toMatchObject({ nome: "Leite condensado", levas: 23, falta: false });
  });

  it("texto do estoque com embalagem e unidades grandes", () => {
    expect(textoEstoque(18565, "g", 395)).toBe("47 un de 395 g");
    expect(textoEstoque(1500, "g", 1)).toBe("1,5 kg");
    expect(textoEstoque(12, "un", 1)).toBe("12 un");
  });
});
