import { describe, expect, it } from "vitest";
import { avisoDaOferta, economiaDoAnual, equivalenteMensal, planosDaTela, podeComprar } from "./planos";
import { PRODUTO, type OfertaApple, type ProdutoApple } from "../types";

const p = (id: string, preco: string, formatado: string, unidade: "mes" | "ano", moeda = "BRL"): ProdutoApple =>
  ({ id, nome: id, descricao: "", preco, precoFormatado: formatado, moeda, periodo: { unidade, valor: 1 } });
const ESS = p(PRODUTO.essencial, "29.9", "R$ 29,90", "mes"), MENSAL = p(PRODUTO.proMensal, "49.9", "R$ 49,90", "mes"), ANUAL = p(PRODUTO.proAnual, "419.9", "R$ 419,90", "ano");
const oferta = (o: Partial<OfertaApple>): OfertaApple => ({ plano: "livre", motivo: null, apple: null, banco: "livre", ...o });

describe("what the plans screen shows comes from StoreKit's prices", () => {
  it("with the approved prices: the annual plan saves about 30% and equals R$ 34,99 a month", () => {
    expect(economiaDoAnual(ANUAL, MENSAL)).toBe(30);
    expect(equivalenteMensal(ANUAL)?.replace(/\s/g, " ")).toBe("R$ 34,99");
  });

  it("another price or another currency changes the numbers: nothing is fixed in the app", () => {
    const anualUsd = p(PRODUTO.proAnual, "79.99", "$79.99", "ano", "USD"), mensalUsd = p(PRODUTO.proMensal, "9.99", "$9.99", "mes", "USD");
    expect(economiaDoAnual(anualUsd, mensalUsd)).toBe(33);
    expect(equivalenteMensal(anualUsd, "en-US")).toBe("$6.66");
    const tela = planosDaTela([ESS, mensalUsd, anualUsd]);
    expect(tela.map((x) => x.preco)).toEqual(["R$ 29,90", "$9.99", "$79.99"]);
    expect(tela[2]?.economia).toBe(33);
  });

  it("the price on each card is the amount CHARGED with its period; the monthly equivalent exists only for the annual plan", () => {
    const tela = planosDaTela([ANUAL, MENSAL, ESS]);
    expect(tela.map((x) => [x.id, x.preco, x.periodo])).toEqual([[PRODUTO.essencial, "R$ 29,90", "/mês"], [PRODUTO.proMensal, "R$ 49,90", "/mês"], [PRODUTO.proAnual, "R$ 419,90", "/ano"]]);
    expect(tela[0]?.equivalente).toBeUndefined();
    expect(tela[1]?.economia).toBeUndefined();
    expect(tela[2]).toMatchObject({ anual: true, economia: 30 });
  });

  it("no saving is claimed when there is none, or when a price is missing", () => {
    expect(economiaDoAnual(p(PRODUTO.proAnual, "700", "R$ 700,00", "ano"), MENSAL)).toBeNull();
    expect(economiaDoAnual(ANUAL, undefined)).toBeNull();
    expect(economiaDoAnual(p(PRODUTO.proAnual, "abc", "?", "ano"), MENSAL)).toBeNull();
    expect(planosDaTela([ANUAL])[0]?.economia).toBeUndefined();
  });

  it("a product StoreKit did not return is left out; the bank add-on is never on the plans screen", () => {
    expect(planosDaTela([ESS, p(PRODUTO.banco, "12.9", "R$ 12,90", "mes")]).map((x) => x.id)).toEqual([PRODUTO.essencial]);
    expect(planosDaTela([])).toEqual([]);
  });
});

describe("who may buy is the server's answer", () => {
  it("a Hotmart subscriber (active, in tolerance, being processed, with a pending payment), a courtesy or a suspended account is never offered the main plan", () => {
    for (const motivo of ["hotmart_ativa", "hotmart_em_tolerancia", "hotmart_processando", "hotmart_pagamento_pendente", "cortesia", "suspensa"] as const) {
      const o = oferta({ plano: "bloqueado", motivo });
      for (const id of [PRODUTO.essencial, PRODUTO.proMensal, PRODUTO.proAnual]) expect(podeComprar(o, id)).toBe(false);
      expect(avisoDaOferta(o)?.titulo).toBeTruthy();
    }
  });

  it("no answer from the server yet, or an error: nothing can be bought", () => {
    expect(podeComprar(undefined, PRODUTO.proAnual)).toBe(false);
    expect(podeComprar(null, PRODUTO.banco)).toBe(false);
  });

  it("free account: the three plans. Apple plan already active: only a CHANGE to another plan", () => {
    expect([PRODUTO.essencial, PRODUTO.proMensal, PRODUTO.proAnual].every((id) => podeComprar(oferta({}), id))).toBe(true);
    const troca = oferta({ plano: "trocar", apple: { produto: PRODUTO.essencial, renova: true, ate: "2026-12-27T00:00:00Z" } });
    expect(podeComprar(troca, PRODUTO.essencial)).toBe(false);
    expect(podeComprar(troca, PRODUTO.proAnual)).toBe(true);
  });

  it("the bank add-on follows its own answer, also for a Hotmart subscriber", () => {
    expect(podeComprar(oferta({ plano: "bloqueado", motivo: "hotmart_ativa", banco: "livre" }), PRODUTO.banco)).toBe(true);
    for (const banco of ["ja_tem", "sem_plano", "bloqueado"] as const) expect(podeComprar(oferta({ banco }), PRODUTO.banco)).toBe(false);
  });
});
