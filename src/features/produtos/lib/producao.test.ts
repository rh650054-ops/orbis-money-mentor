import { describe, expect, it } from "vitest";
import { itensDeProducao, itensParaEnviar, mensagemDaProducao, novaChave, situacaoDoItem, type CatalogoProducao } from "./producao";

const bat = { id: "bat", name: "Batida", emoji: "🥤", recipe_mode: "batch", batch_yield: 10, origem: "faz" as const, stock_quantity: 0 };
const base = (over: Partial<CatalogoProducao> = {}): CatalogoProducao => ({
  produtos: [bat, { id: "agua", name: "Água", emoji: null, recipe_mode: "none", batch_yield: 0, origem: "compra", stock_quantity: 24 }],
  sabores: [
    { id: "mor", product_id: "bat", name: "Morango", emoji: "🍓", stock_quantity: 0, batch_yield: 6, usa_base: true },
    { id: "caf", product_id: "bat", name: "Café", emoji: "☕", stock_quantity: 0, batch_yield: 8, usa_base: false },
  ],
  receitas: [
    { product_id: "bat", variant_id: null, ingredient_id: "lc", quantity: 1, aprender: false },
    { product_id: "bat", variant_id: "mor", ingredient_id: "morango", quantity: 300, aprender: false },
  ],
  ingredientes: [],
  ...over,
});

describe("produção — mesmas regras do banco", () => {
  it("um item por sabor, com o rendimento do sabor; revenda fica de fora", () => {
    const g = itensDeProducao(base());
    expect(g.map((x) => x.produto.id)).toEqual(["bat"]);
    expect(g[0]!.itens.map((i) => [i.sabor?.name, i.rende, i.situacao])).toEqual([["Morango", 6, "pronta"], ["Café", 8, "incompleta"]]);
  });

  it("sabor com receita própria ignora a base; ingrediente sem quantidade ou 'aprender' = incompleta", () => {
    const c = base();
    expect(situacaoDoItem(c, bat, c.sabores[1]!)).toBe("incompleta");
    const c2 = base({ receitas: [...c.receitas, { product_id: "bat", variant_id: null, ingredient_id: "acucar", quantity: 0, aprender: false }] });
    expect(situacaoDoItem(c2, bat, c2.sabores[0]!)).toBe("incompleta");
    const c3 = base({ receitas: [{ ...c.receitas[0]!, aprender: true }, c.receitas[1]!] });
    expect(situacaoDoItem(c3, bat, null)).toBe("incompleta");
  });

  it("sem receita nenhuma = sem_receita; sem rendimento = sem_rendimento", () => {
    expect(situacaoDoItem(base({ receitas: [] }), bat, null)).toBe("sem_receita");
    expect(situacaoDoItem(base(), { ...bat, batch_yield: 0 }, null)).toBe("sem_rendimento");
  });

  it("monta o envio só com as linhas que têm unidades", () => {
    expect(itensParaEnviar({ "bat:mor": 12, "bat:caf": 0, "bri:-": 20 })).toEqual([
      { produto: "bat", sabor: "mor", unidades: 12 }, { produto: "bri", unidades: 20 },
    ]);
  });

  it("traduz as recusas e a falta de rede", () => {
    expect(mensagemDaProducao({ hint: "VANT_UNIDADES_VENDIDAS", message: "x" }).texto).toMatch(/já foram vendidas/);
    expect(mensagemDaProducao({ message: "Failed to fetch" }).codigo).toBe("SEM_REDE");
  });

  it("chave válida para o banco", () => {
    expect(novaChave()).toMatch(/^[A-Za-z0-9:._-]{8,100}$/);
  });
});
