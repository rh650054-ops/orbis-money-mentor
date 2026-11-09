import { describe, expect, it } from "vitest";
import { cabeNoPlano, repetidasDoMesmoBanco, type Ativa } from "../../supabase/functions/_shared/pluggy-vaga";

const a = (id: string, banco: string, criada: string, item = `it-${id}`): Ativa => ({ id, item_id: item, institution_name: banco, created_at: criada });

describe("repetidasDoMesmoBanco (09/11: one connection per bank, newest stays)", () => {
  it("4 Mercado Pago connections from one OAuth loop: only the newest stays", () => {
    const l = [a("1", "Mercado Pago", "2026-11-09T10:55:02Z"), a("2", "Mercado Pago", "2026-11-09T10:55:12Z"),
      a("3", "Mercado Pago", "2026-11-09T10:55:24Z"), a("4", "Mercado Pago", "2026-11-09T10:55:36Z")];
    expect(repetidasDoMesmoBanco(l).sort()).toEqual(["1", "2", "3"]);
  });
  it("reconnecting a broken bank: the old one goes, the new one stays", () => {
    expect(repetidasDoMesmoBanco([a("velha", "Cora", "2026-11-07T15:55:00Z"), a("nova", "Cora", "2026-11-08T13:03:00Z")])).toEqual(["velha"]);
  });
  it("different banks are untouched (Nubank and Nubank Empresas are two banks)", () => {
    expect(repetidasDoMesmoBanco([a("1", "Nubank", "2026-10-07T00:00:00Z"), a("2", "Nubank Empresas", "2026-10-17T00:00:00Z")])).toEqual([]);
  });
});

describe("cabeNoPlano (Pro monthly = 1 bank)", () => {
  it("Pro monthly with Nubank: a second bank does not fit", () => {
    expect(cabeNoPlano([a("1", "Nubank", "2026-10-01T00:00:00Z")], "Mercado Pago", "novo", 1)).toBe(false);
  });
  it("Pro monthly with Nubank: Nubank again fits (it replaces the old one)", () => {
    expect(cabeNoPlano([a("1", "Nubank", "2026-10-01T00:00:00Z")], "Nubank", "novo", 1)).toBe(true);
  });
  it("the item being saved never counts against itself", () => {
    expect(cabeNoPlano([a("1", "Itaú", "2026-11-09T00:00:00Z", "novo")], "Itaú", "novo", 1)).toBe(true);
  });
  it("annual (2 banks) with one bank: a second fits", () => {
    expect(cabeNoPlano([a("1", "Nubank", "2026-10-01T00:00:00Z")], "Mercado Pago", "novo", 2)).toBe(true);
  });
  it("exempt (limit null) always fits", () => {
    expect(cabeNoPlano([a("1", "Nubank", "x"), a("2", "C6", "x")], "Itaú", "novo", null)).toBe(true);
  });
});
