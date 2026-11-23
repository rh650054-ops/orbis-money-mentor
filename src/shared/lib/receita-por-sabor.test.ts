import { describe, expect, it } from "vitest";
import { temIngredienteRepetido, temReceitaPorSabor } from "./receita-por-sabor";

describe("receita por sabor — o que a ficha antiga não sabe fazer", () => {
  it("sabores de hoje (sem rendimento próprio, usando a base): a ficha antiga continua igual", () => {
    expect(temReceitaPorSabor([])).toBe(false);
    expect(temReceitaPorSabor([{ batch_yield: null, usa_base: true }, {}])).toBe(false);
  });

  it("banco ainda sem as colunas novas (consulta falhou → lista vazia): nada muda", () => {
    expect(temReceitaPorSabor([])).toBe(false);
  });

  it("um sabor com rendimento próprio ou sem a base: só pelo cadastro novo", () => {
    expect(temReceitaPorSabor([{ batch_yield: null, usa_base: true }, { batch_yield: 6, usa_base: true }])).toBe(true);
    expect(temReceitaPorSabor([{ batch_yield: "6" }])).toBe(true);
    expect(temReceitaPorSabor([{ batch_yield: null, usa_base: false }])).toBe(true);
  });

  it("mesmo ingrediente em duas linhas do produto (base + sabor): a ficha antiga juntaria tudo na base", () => {
    expect(temIngredienteRepetido([{ ingredient_id: "a" }, { ingredient_id: "b" }])).toBe(false);
    expect(temIngredienteRepetido([{ ingredient_id: "a" }, { ingredient_id: "b" }, { ingredient_id: "a" }])).toBe(true);
  });
});
