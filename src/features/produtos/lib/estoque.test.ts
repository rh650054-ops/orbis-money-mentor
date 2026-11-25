import { describe, expect, it } from "vitest";
import type { CatalogoProducao } from "./producao";
import { alertasDoEstoque, listaDeCompras, pareceCusto, qtdNaTela, receitasComAtencao, situacaoDosIngredientes, textoDaLista } from "./estoque";

// Fictional data shaped like a real Cremo catalogue: two products, one with a flavour that has its own
// recipe and yield; "Produção" (labour) typed as an ingredient with stock 0.
const ing = (id: string, name: string, unit: string, stock: number, pacote = 1) => ({ id, name, unit, stock_quantity: stock, pacote_qtd: pacote });
const r = (product_id: string, ingredient_id: string, quantity: number, variant_id: string | null = null, aprender = false) => ({ product_id, variant_id, ingredient_id, quantity, aprender });
const c: CatalogoProducao = {
  produtos: [
    { id: "mar", name: "Cremo Maracujá", emoji: "🥭", recipe_mode: "batch", batch_yield: 5, origem: "faz", stock_quantity: 20 },
    { id: "mor", name: "Cremo Morango", emoji: "🍓", recipe_mode: "batch", batch_yield: 5, origem: "faz", stock_quantity: 5 },
  ],
  sabores: [{ id: "vmor", product_id: "mor", name: "Morango", emoji: "🍓", stock_quantity: 0, batch_yield: 6, usa_base: false }],
  receitas: [
    r("mar", "lc", 1), r("mar", "garrafa", 5), r("mar", "adesivo", 5), r("mar", "canudo", 5), r("mar", "polpa", 40), r("mar", "prod", 5),
    r("mor", "lc", 1, "vmor"), r("mor", "garrafa", 6, "vmor"), r("mor", "adesivo", 6, "vmor"), r("mor", "canudo", 6, "vmor"), r("mor", "morango", 300, "vmor"), r("mor", "prod", 6, "vmor"),
  ],
  ingredientes: [
    ing("lc", "Leite condensado", "un", 114), { ...ing("garrafa", "Garrafa 300ml", "un", 100), cost_per_unit: 1.19 }, ing("adesivo", "Adesivo", "un", 0),
    ing("canudo", "Canudo", "un", 100, 100), ing("polpa", "Maracujá", "g", 1000, 1000), ing("morango", "Morando congelado", "g", 2000, 1000), ing("prod", "Produção", "un", 0),
  ],
};

describe("Aba Estoque — o que preciso comprar (25/11)", () => {
  it("40 de maracujá: 8 receitas (rende 5) → 40 adesivos, tem 0, comprar 40; leite condensado 8 de 114: ok", () => {
    const l = listaDeCompras(c, [{ produto: "mar", sabor: null, unidades: 40 }]);
    const por = new Map(l.linhas.map((x) => [x.nome, x]));
    expect(por.get("Adesivo")).toMatchObject({ precisa: 40, tem: 0, falta: 40 });
    expect(por.get("Leite condensado")).toMatchObject({ precisa: 8, tem: 114, falta: 0 });
    expect(por.get("Maracujá")).toMatchObject({ precisa: 320, tem: 1000, falta: 0 });
    // labour typed as an ingredient is not something to buy
    expect(por.get("Produção")).toMatchObject({ custo: true, falta: 0 });
    expect(l.parciais).toEqual([]);
  });

  it("vários sabores: ingrediente compartilhado soma o consumo e conta o estoque uma vez só", () => {
    // 40 maracujá (rende 5) + 36 morango (sabor rende 6): canudo 40 + 36 = 76 of 100; adesivo 76 of 0
    const l = listaDeCompras(c, [{ produto: "mar", sabor: null, unidades: 40 }, { produto: "mor", sabor: "vmor", unidades: 36 }]);
    const por = new Map(l.linhas.map((x) => [x.nome, x]));
    expect(por.get("Canudo")).toMatchObject({ precisa: 76, tem: 100, falta: 0 });
    expect(por.get("Adesivo")).toMatchObject({ precisa: 76, falta: 76 });
    expect(por.get("Garrafa 300ml")).toMatchObject({ precisa: 76, tem: 100, falta: 0 });
    expect(por.get("Adesivo")!.usadoEm).toEqual(["Cremo Maracujá", "Cremo Morango"]);
  });

  it("receita incompleta: a previsão é parcial e não inventa a quantidade que falta", () => {
    const inc: CatalogoProducao = { ...c, receitas: [...c.receitas, r("mar", "garrafa", 0, null, true)].map((x) => (x.ingredient_id === "polpa" ? { ...x, quantity: 0, aprender: true } : x)) };
    const l = listaDeCompras(inc, [{ produto: "mar", sabor: null, unidades: 10 }]);
    expect(l.parciais[0]!.motivo).toMatch(/Maracujá/);
    expect(l.linhas.find((x) => x.nome === "Maracujá")).toBeUndefined();
  });

  it("é só consulta: o catálogo não muda", () => {
    const antes = JSON.stringify(c);
    listaDeCompras(c, [{ produto: "mar", sabor: null, unidades: 400 }]);
    alertasDoEstoque(c);
    expect(JSON.stringify(c)).toBe(antes);
  });
});

describe("Lista de compras completa (25/11, refino)", () => {
  it("50 + 50: garrafa precisa 50 + 60 = 110, tem 100, comprar 10 ≈ R$ 11,90; lista TODOS os ingredientes; texto para compartilhar", () => {
    // maracujá yields 5 (5 bottles per recipe) → 50; morango flavour yields 6 (6 per recipe) → 50
    const l = listaDeCompras(c, [{ produto: "mar", sabor: null, unidades: 50 }, { produto: "mor", sabor: "vmor", unidades: 50 }]);
    const g = l.linhas.find((x) => x.nome === "Garrafa 300ml")!;
    expect(g).toMatchObject({ precisa: 100, tem: 100, falta: 0, custoCompra: null });
    expect(l.linhas.map((x) => x.nome).sort()).toEqual(["Adesivo", "Canudo", "Garrafa 300ml", "Leite condensado", "Maracujá", "Morando congelado", "Produção"].sort());
    const l2 = listaDeCompras(c, [{ produto: "mar", sabor: null, unidades: 60 }, { produto: "mor", sabor: "vmor", unidades: 50 }]);
    expect(l2.linhas.find((x) => x.nome === "Garrafa 300ml")).toMatchObject({ precisa: 110, tem: 100, falta: 10, custoCompra: 11.9 });
    const t = textoDaLista([{ nome: "Cremo Maracujá", unidades: 60 }], l2, new Set());
    expect(t).toMatch(/Garrafa 300ml: comprar 10 un \(precisa 110, tem 100 un\) ≈ R\$\s?11,90/);
    expect(t).not.toMatch(/Produção/);
  });
});

describe("Aba Estoque — atenção e ingredientes (25/11)", () => {
  it("diz qual ingrediente falta, quanto tem, quanto 1 receita precisa e quem é afetado; custo é apontado à parte", () => {
    const a = alertasDoEstoque(c);
    const adesivo = a.find((x) => x.ingrediente === "Adesivo")!;
    expect(adesivo).toMatchObject({ tipo: "esgotado", tem: 0, precisa: 6, falta: 6 });
    expect(adesivo.afetados).toEqual(["Cremo Maracujá", "Cremo Morango"]);
    expect(a.find((x) => x.ingrediente === "Produção")!.tipo).toBe("custo");
    expect(a.some((x) => x.ingrediente === "Leite condensado")).toBe(false);
    expect(receitasComAtencao(a)).toBe(2);   // two items, counted once each
  });

  it("receita incompleta é alerta de receita, não de ingrediente faltando", () => {
    const inc: CatalogoProducao = { ...c, receitas: c.receitas.map((x) => (x.ingredient_id === "polpa" ? { ...x, quantity: 0, aprender: true } : x)) };
    const a = alertasDoEstoque(inc);
    expect(a.find((x) => x.tipo === "incompleta")!.titulo).toMatch(/Maracujá/);
    expect(a.some((x) => x.ingrediente === "Maracujá")).toBe(false);
  });

  it("situação: esgotado (0), baixo (não dá 1 receita), disponível", () => {
    const s = situacaoDosIngredientes({ ...c, ingredientes: c.ingredientes.map((i) => (i.id === "garrafa" ? { ...i, stock_quantity: 4 } : i)) });
    expect(s.get("adesivo")).toBe("esgotado");
    expect(s.get("garrafa")).toBe("baixo");
    expect(s.get("lc")).toBe("disponivel");
  });

  it("unidades: 1000 g = 1 kg, 1500 ml = 1,5 L, 100 un = 1 pacote de 100; nunca un vira litro", () => {
    expect(qtdNaTela(1000, "g", 1000)).toEqual({ principal: "1 kg", sub: "1 embalagem de 1 kg" });
    expect(qtdNaTela(1500, "ml")).toEqual({ principal: "1,5 L" });
    expect(qtdNaTela(100, "un", 100)).toEqual({ principal: "100 un", sub: "1 pacote de 100 un" });
    expect(qtdNaTela(350, "g", 650)).toEqual({ principal: "350 g" });   // no "0,54 embalagens"
    expect(qtdNaTela(18, "un")).toEqual({ principal: "18 un" });
    expect(pareceCusto("Produção")).toBe(true);
    expect(pareceCusto("Mão de obra")).toBe(true);
    expect(pareceCusto("Leite condensado")).toBe(false);
    expect(pareceCusto("Produção de calda")).toBe(false);
  });
});
