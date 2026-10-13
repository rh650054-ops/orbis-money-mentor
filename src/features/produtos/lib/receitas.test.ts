import { describe, expect, it } from "vitest";
import {
  ingredientesSugeridos, levasPossiveis, novoIngrediente, precoDe1, rascunhoDaReceita, receitaDoRascunho, totalDaReceita,
} from "./receitas";
import { custoPorUnidade } from "./conta";

const ing = (nome: string, qtd: number, precoPacote: number, pacote = 1, usa = true) =>
  ({ ...novoIngrediente(nome, qtd), precoPacote, pacote, usa });

describe("receita de quem faz", () => {
  it("sugere os ingredientes comuns; embalagem vai 1 por unidade e vem em pacote", () => {
    expect(ingredientesSugeridos("Trufa de maracujá").map((i) => i.nome)).toContain("Leite condensado");
    expect(ingredientesSugeridos("Capinha").length).toBe(2);
    const batida = ingredientesSugeridos("Batida", 20);
    expect(batida.map((i) => i.nome)).toEqual(["Leite condensado", "Creme de leite", "Fruta / polpa", "Copo e canudo"]);
    expect(batida.find((i) => i.nome === "Copo e canudo")).toMatchObject({ qtd: 20, pacote: 100, unidade: "un" });
    expect(batida.find((i) => i.nome === "Leite condensado")).toMatchObject({ qtd: 1, pacote: 1 });
  });

  it("preço de 1 sai do pacote: 100 canudos por R$ 8 = R$ 0,08; lata de 800 g por R$ 30", () => {
    expect(precoDe1({ pacote: 100, precoPacote: 8 })).toBeCloseTo(0.08);
    expect(precoDe1({ pacote: 800, precoPacote: 30 })).toBeCloseTo(0.0375);
    expect(precoDe1({ pacote: 1, precoPacote: 0 })).toBe(0);
  });

  it("custo da leva soma qtd × preço de 1 (com pacote) do que ele marcou; ÷ rendimento", () => {
    const itens = [
      ing("Leite condensado", 1, 4.5),
      ing("Creme de leite", 1, 2.46),
      ing("Maracujá", 15, 10, 15),          // 15 maracujás por uns R$ 10
      ing("Leite em pó", 200, 30, 800),     // 200 g de uma lata de 800 g por R$ 30
      ing("Canudo", 20, 8, 100),            // 20 de um pacote de 100 por R$ 8
      ing("Granulado", 1, 9, 1, false),
    ];
    expect(totalDaReceita(itens)).toBe(26.06); // 4,50 + 2,46 + 10 + 7,50 + 1,60
    expect(custoPorUnidade(totalDaReceita(itens), 20)).toBe(1.3);
  });

  it("salva só o marcado, com unidade e pacote (e volta igual)", () => {
    const r = receitaDoRascunho([
      { ...ing(" Leite em pó ", 200, 30, 800), unidade: "g" },
      ing("Copo", 20, 0, 50),
      ing("Granulado", 1, 4, 1, false),
      ing("", 1, 0),
      ing("Fruta", 0, 2),
    ]);
    expect(r).toEqual([
      { nome: "Leite em pó", qtd: 200, preco: 0.0375, unidade: "g", pacote: 800 },
      { nome: "Copo", qtd: 20, preco: 0, unidade: "un", pacote: 50 },
    ]);
    expect(receitaDoRascunho(rascunhoDaReceita(r))).toEqual(r);
  });

  it("quantas levas dá pra fazer: a menor de todas", () => {
    expect(levasPossiveis([{ qtd: 1, estoque: 57 }, { qtd: 1, estoque: 60 }])).toBe(57);
    expect(levasPossiveis([{ qtd: 2, estoque: 9 }, { qtd: 0.5, estoque: 10 }])).toBe(4);
    expect(levasPossiveis([{ qtd: 1, estoque: 0 }, { qtd: 1, estoque: 10 }])).toBe(0);
    expect(levasPossiveis([])).toBe(0);
  });
});
