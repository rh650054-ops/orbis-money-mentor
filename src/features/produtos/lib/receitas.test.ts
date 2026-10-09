import { describe, expect, it } from "vitest";
import { ingredientesSugeridos, totalDaReceita } from "./receitas";
import { custoPorUnidade } from "./conta";

describe("não sei quanto gasto: a VANT calcula pela receita", () => {
  it("sugere os ingredientes comuns do tipo de produto", () => {
    expect(ingredientesSugeridos("Trufa de maracujá").map((i) => i.nome)).toContain("Leite condensado");
    expect(ingredientesSugeridos("Batida de morango").map((i) => i.nome)).toContain("Copo e canudo");
    expect(ingredientesSugeridos("Capinha").length).toBe(2);
  });

  it("soma só o que ele marcou e divide pelo rendimento", () => {
    const itens = [
      { nome: "Chocolate", preco: 32, usa: true },
      { nome: "Leite condensado", preco: 11, usa: true },
      { nome: "Creme de leite", preco: 3.5, usa: true },
      { nome: "Forminha", preco: 6, usa: true },
      { nome: "Recheio", preco: 9, usa: false },
    ];
    expect(totalDaReceita(itens)).toBe(52.5);
    expect(custoPorUnidade(totalDaReceita(itens), 30)).toBe(1.75);
  });
});
