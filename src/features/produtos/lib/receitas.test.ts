import { describe, expect, it } from "vitest";
import { ingredientesSugeridos, levasPossiveis, rascunhoDaReceita, receitaDoRascunho, totalDaReceita } from "./receitas";
import { custoPorUnidade } from "./conta";

describe("receita de quem faz", () => {
  it("sugere os ingredientes comuns do tipo de produto, 1 de cada", () => {
    expect(ingredientesSugeridos("Trufa de maracujá").map((i) => i.nome)).toContain("Leite condensado");
    expect(ingredientesSugeridos("Batida de morango").map((i) => i.nome)).toContain("Copo e canudo");
    expect(ingredientesSugeridos("Capinha").length).toBe(2);
    expect(ingredientesSugeridos("Batida").every((i) => i.qtd === 1)).toBe(true);
  });

  it("custo da leva = soma de qtd × preço de 1 do que ele marcou; ÷ rendimento", () => {
    const itens = [
      { nome: "Chocolate", qtd: 1, preco: 32, usa: true },
      { nome: "Leite condensado", qtd: 2, preco: 5.5, usa: true },
      { nome: "Creme de leite", qtd: 1, preco: 3.5, usa: true },
      { nome: "Forminha", qtd: 1, preco: 6, usa: true },
      { nome: "Recheio", qtd: 1, preco: 9, usa: false },
    ];
    expect(totalDaReceita(itens)).toBe(52.5);
    expect(custoPorUnidade(totalDaReceita(itens), 30)).toBe(1.75);
  });

  it("salva só o marcado, com nome e quantidade (e volta igual)", () => {
    const r = receitaDoRascunho([
      { nome: " Leite condensado ", qtd: 1, preco: 6.5, usa: true },
      { nome: "Copo", qtd: 20, preco: 0, usa: true },
      { nome: "Granulado", qtd: 1, preco: 4, usa: false },
      { nome: "", qtd: 1, preco: 0, usa: true },
      { nome: "Fruta", qtd: 0, preco: 2, usa: true },
    ]);
    expect(r).toEqual([{ nome: "Leite condensado", qtd: 1, preco: 6.5 }, { nome: "Copo", qtd: 20, preco: 0 }]);
    expect(receitaDoRascunho(rascunhoDaReceita(r))).toEqual(r);
  });

  it("quantas levas dá pra fazer: a menor de todas", () => {
    expect(levasPossiveis([{ qtd: 1, estoque: 57 }, { qtd: 1, estoque: 60 }])).toBe(57);
    expect(levasPossiveis([{ qtd: 2, estoque: 9 }, { qtd: 0.5, estoque: 10 }])).toBe(4);
    expect(levasPossiveis([{ qtd: 1, estoque: 0 }, { qtd: 1, estoque: 10 }])).toBe(0);
    expect(levasPossiveis([])).toBe(0);
  });
});
