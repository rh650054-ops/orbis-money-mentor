import { describe, expect, it } from "vitest";
import { situacaoDoCadastro } from "./situacao-cadastro";
import { RASCUNHO_VAZIO } from "../types";
import { adiarConvite, ADIAR_DIAS, deveMostrarConvite, lerConvite, nuncaMaisConvite } from "./convite-cadastro";
import { apagarRascunho, guardarRascunho, lerRascunho } from "./rascunho-cadastro";
import { ehRascunho, ingredienteIgual, nomeNormalizado, novoIngrediente, receitaCompleta } from "./receitas";
import { custoDoSabor, ingredientesEmConflito, saboresParaSalvar } from "./sabores";

const ing = (nome: string, qtd: number, precoPacote = 0, pacote = 1) => ({ ...novoIngrediente(nome, qtd), precoPacote, pacote });

describe("sabores com receitas diferentes (sem base, cada sabor tem a sua)", () => {
  const morango = { nome: "Morango", emoji: "🍓", itens: [ing("Leite condensado", 1, 6.5), ing("Morango", 500, 20, 1000)] };
  const nutella = { nome: "Nutella", emoji: "🍫", itens: [ing("Creme de leite", 1, 3), ing("Nutella", 140, 28, 140)] };
  it("cada sabor custa pela própria receita", () => {
    expect(custoDoSabor([], morango, 20)).toBe(0.83);   // (6,50 + 10,00) ÷ 20
    expect(custoDoSabor([], nutella, 20)).toBe(1.55);   // (3,00 + 28,00) ÷ 20
  });
  it("cada sabor vai pro banco com os próprios ingredientes", () => {
    const s = saboresParaSalvar([morango, nutella]);
    expect(s.map((x) => x.itens.map((i) => i.nome))).toEqual([["Leite condensado", "Morango"], ["Creme de leite", "Nutella"]]);
  });
});

describe("um ingrediente em um lugar só do produto (UNIQUE product_id, ingredient_id de hoje)", () => {
  const sab = (nome: string, itens: ReturnType<typeof ing>[]) => ({ nome, emoji: "", itens });
  it("o mesmo ingrediente em dois sabores é apontado antes de salvar (o banco recusaria)", () => {
    const c = ingredientesEmConflito([], [sab("Morango", [ing("Leite condensado", 1)]), sab("Nutella", [ing("leite  condensado", 1), ing("Nutella", 140)])]);
    expect([...c]).toEqual(["1:0"]);
  });
  it("na base e num sabor também", () => {
    expect([...ingredientesEmConflito([ing("Leite condensado", 1)], [sab("Morango", [ing("Leite Condensado", 1), ing("Morango", 500)])])]).toEqual(["0:0"]);
  });
  it("ingredientes diferentes, ou linhas desmarcadas, passam", () => {
    expect(ingredientesEmConflito([ing("Leite", 1)], [sab("A", [ing("Morango", 1)]), sab("B", [{ ...ing("Leite", 1), usa: false }])]).size).toBe(0);
  });
});

describe("cadastro incompleto não alimenta produção", () => {
  it("receita só fica completa com rendimento e ao menos um ingrediente com quantidade", () => {
    expect(receitaCompleta([ing("Leite", 1)], 20)).toBe(true);
    expect(receitaCompleta([ing("Leite", 1)], 0)).toBe(false);
    expect(receitaCompleta([ing("Leite", 0)], 20)).toBe(false);
    expect(receitaCompleta([ing("Leite", 1), ing("Polpa", 0)], 20)).toBe(false);                        // one missing = incomplete
    expect(receitaCompleta([ing("Leite", 1), { ...ing("Polpa", 0), usa: false }], 20)).toBe(true);      // unchecked lines do not count
    expect(receitaCompleta([ing("Leite", 1), { ...ing("Polpa", 5), aprender: true }], 20)).toBe(false);  // "descubro depois" = missing
    expect(ehRascunho(ing("Leite", 0))).toBe(true);
  });
  it("a revisão diz a verdade sobre cada caso", () => {
    const base = { ...RASCUNHO_VAZIO, nome: "X" };
    expect(situacaoDoCadastro({ ...base, origem: "compra" }).titulo).toBe("Revenda");
    expect(situacaoDoCadastro({ ...base, origem: null }).titulo).toBe("Configurar depois");
    expect(situacaoDoCadastro({ ...base, origem: "faz", receita: null }).titulo).toBe("Sem receita");
    expect(situacaoDoCadastro({ ...base, origem: "faz", rende: 20, receita: [{ nome: "Leite", qtd: 0, preco: 0, unidade: "un", pacote: 1, aprender: true }] }).titulo).toBe("Receita em rascunho");
    expect(situacaoDoCadastro({ ...base, origem: "faz", rende: 0, receita: [{ nome: "Leite", qtd: 1, preco: 0, unidade: "un", pacote: 1 }] }).titulo).toBe("Receita parcialmente configurada");
    // 23/11: one ingredient with quantity is not enough; "descubro depois" counts as missing
    const parcial = situacaoDoCadastro({ ...base, origem: "faz", rende: 20, receita: [{ nome: "Leite", qtd: 1, preco: 0, unidade: "un", pacote: 1 }, { nome: "Polpa", qtd: 0, preco: 0, unidade: "g", pacote: 1000, aprender: true }] });
    expect(parcial).toMatchObject({ titulo: "Receita parcialmente configurada", completar: true });
    expect(parcial.texto).toContain("Falta informar a quantidade de 1 ingrediente.");
    expect(parcial.texto).not.toMatch(/pode usar a produção automática/i);
    expect(situacaoDoCadastro({ ...base, origem: "faz", rende: 20, receita: [{ nome: "Leite", qtd: 1, preco: 0, unidade: "un", pacote: 1 }] }).titulo).toBe("Receita pronta");
  });
});

describe("mesmo ingrediente escrito diferente", () => {
  it("normaliza maiúsculas, acentos, espaços, plural e pontuação", () => {
    expect(nomeNormalizado("  Leites  CONDENSADOS ")).toBe("leite condensado");
    expect(nomeNormalizado("Açúcar")).toBe(nomeNormalizado("acucar"));
    expect(nomeNormalizado("Copo/canudo")).toBe("copo canudo");
  });
  it("só junta quando é o mesmo depois de normalizar", () => {
    const g = [{ id: "1", nome: "Leite condensado" }, { id: "2", nome: "Leite em pó" }];
    expect(ingredienteIgual("leite  condensado", g)?.id).toBe("1");
    expect(ingredienteIgual("Leite", g)).toBeUndefined();
    expect(ingredienteIgual("", g)).toBeUndefined();
  });
});

describe("rascunho do cadastro por usuário", () => {
  it("guarda, devolve sem id e apaga; cada usuário tem o seu", () => {
    localStorage.clear();
    guardarRascunho("u1", { ...RASCUNHO_VAZIO, nome: "Trufa", id: "x" }, "preco");
    expect(lerRascunho("u1")).toMatchObject({ passo: "preco", r: { nome: "Trufa", id: undefined } });
    expect(lerRascunho("u2")).toBeNull();
    apagarRascunho("u1");
    expect(lerRascunho("u1")).toBeNull();
  });
  it("sem nome não guarda nada; conteúdo estragado é ignorado", () => {
    localStorage.clear();
    guardarRascunho("u1", RASCUNHO_VAZIO, "nome");
    expect(lerRascunho("u1")).toBeNull();
    localStorage.setItem("vant_cadastro_rascunho_v1:u1", "{quebrado");
    expect(lerRascunho("u1")).toBeNull();
  });
});

describe("banner do Início: convite, não insistência", () => {
  const dia = 86_400_000;
  it("aparece só para quem tem acesso e 0 produtos", () => {
    expect(deveMostrarConvite({ estado: {}, liberado: true, produtos: 0 })).toBe(true);
    expect(deveMostrarConvite({ estado: {}, liberado: true, produtos: 2 })).toBe(false);
    expect(deveMostrarConvite({ estado: {}, liberado: false, produtos: 0 })).toBe(false);
    expect(deveMostrarConvite({ estado: {}, liberado: true, produtos: undefined })).toBe(false);   // still loading
  });
  it("'Mais tarde' some por 7 dias e o convite volta depois", () => {
    localStorage.clear();
    const agora = Date.UTC(2026, 10, 22);
    adiarConvite("u1", agora);
    const e = lerConvite("u1");
    expect(deveMostrarConvite({ estado: e, liberado: true, produtos: 0, agora: agora + 6 * dia })).toBe(false);
    expect(deveMostrarConvite({ estado: e, liberado: true, produtos: 0, agora: agora + ADIAR_DIAS * dia + 1 })).toBe(true);
  });
  it("'Não mostrar novamente' some de vez, e é por usuário", () => {
    localStorage.clear();
    nuncaMaisConvite("u1");
    expect(deveMostrarConvite({ estado: lerConvite("u1"), liberado: true, produtos: 0, agora: Date.now() + 400 * dia })).toBe(false);
    expect(deveMostrarConvite({ estado: lerConvite("u2"), liberado: true, produtos: 0 })).toBe(true);
  });
});
