import { describe, expect, it } from "vitest";
import { custoPorUnidade, emojiDoNome, lucroDe, ordenarPorLucro, precosVizinhos } from "./conta";

describe("contas do cadastro de produto", () => {
  it("divide o pacote e a leva por unidade", () => {
    expect(custoPorUnidade(22.4, 16)).toBe(1.4);
    expect(custoPorUnidade(48, 30)).toBe(1.6);
    expect(custoPorUnidade(0, 10)).toBe(0);
    expect(custoPorUnidade(10, 0)).toBe(0);
  });

  it("mostra quanto sobra e a % de lucro", () => {
    expect(lucroDe(3, 1.4)).toEqual({ sobra: 1.6, pct: 53 });
    expect(lucroDe(5, 0)).toEqual({ sobra: 5, pct: 100 });
    expect(lucroDe(2, 2.5)).toEqual({ sobra: -0.5, pct: -25 });
    expect(lucroDe(0, 1)).toEqual({ sobra: 0, pct: 0 });
  });

  it("sugere um preço abaixo e um acima", () => {
    expect(precosVizinhos(3)).toEqual([2.5, 3, 3.5]);
    expect(precosVizinhos(10)).toEqual([9, 10, 11]);
    expect(precosVizinhos(0)).toEqual([]);
  });

  it("escolhe o ícone pelo nome", () => {
    expect(emojiDoNome("Trufa de morango")).toBe("🍫");
    expect(emojiDoNome("Mentos")).toBe("🍬");
    expect(emojiDoNome("Água 500ml")).toBe("💧");
    expect(emojiDoNome("Capinha de celular")).toBe("📦");
  });

  it("põe o mais lucrativo no topo e o preço livre no fim", () => {
    const lista = [
      { id: "choco", sale_price: 5, cost: 4.1 },
      { id: "livre", sale_price: 0, cost: 0, open_price: true },
      { id: "batida", sale_price: 10, cost: 3 },
      { id: "mentos", sale_price: 3, cost: 1.4 },
    ];
    expect(ordenarPorLucro(lista).map((p) => p.id)).toEqual(["batida", "mentos", "choco", "livre"]);
  });
});
