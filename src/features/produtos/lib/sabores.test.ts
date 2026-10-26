import { describe, expect, it } from "vitest";
import { custoDoSabor, dividirIgual, emojiDoSabor, saboresParaSalvar } from "./sabores";
import type { IngredienteRascunho } from "./receitas";

const ing = (nome: string, qtd: number, pacote: number, precoPacote: number): IngredienteRascunho => ({ nome, qtd, unidade: "un", pacote, precoPacote, usa: true });

describe("sabores", () => {
  it("custo do sabor = base + extras ÷ rende", () => {
    const base = [ing("Leite condensado", 2, 1, 6.24), ing("Creme de leite", 2, 1, 3.48)];
    const morango = { nome: "Morango", emoji: "🍓", itens: [ing("Morango congelado", 500, 1000, 9.22)] };
    // base 19,44 + morango 4,61 = 24,05 ÷ 20 = 1,2025 → 1.2
    expect(custoDoSabor(base, morango, 20)).toBe(1.2);
    expect(custoDoSabor(base, { nome: "Natural", emoji: "🥤", itens: [] }, 20)).toBe(0.97);
    expect(custoDoSabor(base, { nome: "X", emoji: "", itens: [ing("Nutella", 30, 650, 0)] }, 20)).toBeNull();
  });
  it("emoji pelo nome e divisão igual", () => {
    expect(emojiDoSabor("Maracujá")).toBe("🥭");
    expect(emojiDoSabor("Batida de Nutella")).toBe("🍫");
    expect(emojiDoSabor("Zzz")).toBe("🥤");
    expect(dividirIgual(100, 3)).toEqual([34, 33, 33]);
    expect(dividirIgual(5, 0)).toEqual([]);
  });
  it("só sabores com nome vão pro banco", () => {
    const s = saboresParaSalvar([{ nome: " ", emoji: "", itens: [] }, { id: "a", nome: "Morango", emoji: "", itens: [ing("Morango", 1, 1, 5)] }]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ id: "a", nome: "Morango", emoji: "🍓" });
    expect(s[0]?.itens[0]).toMatchObject({ nome: "Morango", qtd: 1, preco: 5 });
  });
});
