import { describe, expect, it } from "vitest";
import { combosValidos, custoDaFicha, fichaDe, problemaDaFicha } from "./ficha";
import type { ProdutoComFaixas } from "../types";

const batida: ProdutoComFaixas = {
  id: "b", name: "Batida", photo_url: null, cost: 0.9, sale_price: 20, stock_quantity: 479, stock_min: 10,
  open_price: false, recipe_mode: "batch", batch_yield: 50, origem: "faz", emoji: "🥤", controla_estoque: true,
  faixas: [{ qty: 1, price: 20 }, { qty: 2, price: 35 }],
};
const receita = [
  { id: "lc", nome: "Leite condensado", qtd: 1, preco: 6.5, estoque: 3, unidade: "un" as const, pacote: 1 },
  { id: "cl", nome: "Creme de leite", qtd: 1, preco: 0, estoque: 0, unidade: "un" as const, pacote: 1 },
];

describe("ficha do produto", () => {
  it("monta a ficha com receita, combos (sem a faixa de 1) e rendimento", () => {
    const f = fichaDe(batida, receita);
    expect(f.origem).toBe("faz");
    expect(f.combos).toEqual([{ qty: 2, price: 35 }]);
    expect(f.itens.map((i) => i.nome)).toEqual(["Leite condensado", "Creme de leite"]);
    expect(f.rende).toBe(50);
  });

  it("custo pela receita só quando todo ingrediente tem preço; senão o salvo", () => {
    const f = fichaDe(batida, receita);
    expect(custoDaFicha(f)).toEqual({ valor: 0.9, pelaReceita: false });
    const comPreco = { ...f, itens: f.itens.map((i) => ({ ...i, precoPacote: i.precoPacote || 3.5 })) };
    expect(custoDaFicha(comPreco)).toEqual({ valor: 0.2, pelaReceita: true }); // (6,50 + 3,50) ÷ 50
  });

  it("quem compra pronto usa o custo digitado", () => {
    const f = { ...fichaDe({ ...batida, origem: "compra", recipe_mode: "none" }, []), custo: 1.4 };
    expect(f.origem).toBe("compra");
    expect(custoDaFicha(f)).toEqual({ valor: 1.4, pelaReceita: false });
  });

  it("combos: só 2+ com preço, sem repetir quantidade", () => {
    expect(combosValidos([{ qty: 2, price: 35 }, { qty: 3, price: 0 }, { qty: 1, price: 20 }, { qty: 2, price: 34 }]))
      .toEqual([{ qty: 2, price: 34 }]);
  });

  it("diz o que falta pra salvar", () => {
    const f = fichaDe(batida, receita);
    expect(problemaDaFicha(f)).toBeNull();
    expect(problemaDaFicha({ ...f, nome: " " })).toMatch(/nome/);
    expect(problemaDaFicha({ ...f, preco: 0 })).toMatch(/preço/);
    expect(problemaDaFicha({ ...f, preco: 0, precoLivre: true })).toBeNull();
  });
});
