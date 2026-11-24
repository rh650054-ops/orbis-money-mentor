import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { painelDoProduto, resumoDoPainel, situacaoDoEstoque } from "./painel";
import { caminhoDaFoto } from "../api/fotos";
import { problemaDoArquivo } from "../components/foto-produto";
import type { CatalogoProducao } from "./producao";

const c: CatalogoProducao = {
  produtos: [
    { id: "bat", name: "Batida", emoji: null, recipe_mode: "batch", batch_yield: 10, origem: "faz", stock_quantity: 0 },
    { id: "tru", name: "Trufa", emoji: null, recipe_mode: "batch", batch_yield: 20, origem: "faz", stock_quantity: 0 },
  ],
  sabores: [
    { id: "mor", product_id: "bat", name: "Morango", emoji: "🍓", stock_quantity: 0, batch_yield: 6, usa_base: true },
    { id: "mar", product_id: "bat", name: "Maracujá", emoji: "🥭", stock_quantity: 0, batch_yield: 5, usa_base: true },
  ],
  receitas: [
    { product_id: "bat", variant_id: null, ingredient_id: "lc", quantity: 1, aprender: false },
    { product_id: "bat", variant_id: "mor", ingredient_id: "mo", quantity: 300, aprender: false },
    { product_id: "bat", variant_id: "mar", ingredient_id: "po", quantity: 200, aprender: false },
    { product_id: "tru", variant_id: null, ingredient_id: "ch", quantity: 0, aprender: true },
  ],
  ingredientes: [
    { id: "lc", name: "LC", unit: "un", stock_quantity: 1 }, { id: "mo", name: "Morango", unit: "g", stock_quantity: 300 },
    { id: "po", name: "Polpa", unit: "g", stock_quantity: 200 }, { id: "ch", name: "Choc", unit: "g", stock_quantity: 999 },
  ],
};

describe("Produtos e Estoque (24/11)", () => {
  it("receita completa: custo confiável e pode produzir; incompleta: custo nunca exato, não produz", () => {
    expect(painelDoProduto(c, { id: "bat", origem: "faz", cost: 3 })).toMatchObject({ receita: "completa", custoConfiavel: true, podeProduzir: true, sabores: ["Morango", "Maracujá"] });
    expect(painelDoProduto(c, { id: "tru", origem: "faz", cost: 1 })).toMatchObject({ receita: "incompleta", custoConfiavel: false, podeProduzir: false });
    expect(painelDoProduto(c, { id: "agu", origem: "compra", cost: 1.1 })).toMatchObject({ receita: "revenda", custoConfiavel: true, podeProduzir: false });
  });

  it("'pode produzir' conta PRODUTOS: dois sabores que dividem 1 leite condensado não viram 2", () => {
    const painel = [painelDoProduto(c, { id: "bat", origem: "faz", cost: 3 }), painelDoProduto(c, { id: "tru", origem: "faz", cost: 1 })];
    expect(resumoDoPainel([{ stock_quantity: 18 }, { stock_quantity: 3 }, { stock_quantity: 5, controla_estoque: false }], painel))
      .toEqual({ produtos: 3, unidades: 21, podeProduzir: 1 });
  });

  it("situação do estoque", () => {
    expect(situacaoDoEstoque({ stock_quantity: 0 })).toBe("sem");
    expect(situacaoDoEstoque({ stock_quantity: 3, stock_min: 5 })).toBe("baixo");
    expect(situacaoDoEstoque({ stock_quantity: 30 })).toBe("ok");
  });

  it("fotos: só apaga arquivo da própria pasta do vendedor; valida tipo do arquivo", () => {
    const base = "https://x.supabase.co/storage/v1/object/public/product-photos/";
    expect(caminhoDaFoto(`${base}u1/a.jpg`, "u1")).toBe("u1/a.jpg");
    expect(caminhoDaFoto(`${base}u2/a.jpg`, "u1")).toBeNull();
    expect(caminhoDaFoto(`${base}u1/../u2/a.jpg`, "u1")).toBeNull();
    expect(caminhoDaFoto("https://outro.site/u1/a.jpg", "u1")).toBeNull();
    expect(problemaDoArquivo(new File(["x"], "a.pdf", { type: "application/pdf" }))).toMatch(/imagem/);
    expect(problemaDoArquivo(new File(["x"], "a.jpg", { type: "image/jpeg" }))).toBeNull();
  });
});
