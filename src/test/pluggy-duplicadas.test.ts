import { describe, expect, it } from "vitest";
import { copiasRepetidas, titularDe, type Conexao } from "../../supabase/functions/_shared/pluggy-duplicadas";

const agora = Date.parse("2026-11-04T12:00:00Z");
const c = (id: string, user: string, criada: string, banco = "Mercado Pago", dono: string | null = "Joao", extra: Partial<Conexao> = {}): Conexao =>
  ({ id, user_id: user, institution_name: banco, dono_nome: dono, created_at: criada, dono_doc: null, status: "UPDATED", ...extra });
const CPF = "12345678901";
const CNPJ = "12345678000199";

describe("copiasRepetidas", () => {
  it("keeps the oldest and removes the copies of the same account", () => {
    const cons = [c("b", "u1", "2026-11-03T18:44:38Z"), c("a", "u1", "2026-11-03T18:44:25Z"), c("c", "u1", "2026-11-03T18:44:50Z")];
    const contas = new Map([["a", ["DHDCF"]], ["b", ["DHDCF"]], ["c", ["DHDCF"]]]);
    expect(copiasRepetidas(cons, contas, agora).sort()).toEqual(["b", "c"]);
  });
  it("two different accounts of the same bank both stay", () => {
    const cons = [c("a", "u1", "2026-11-03T10:00:00Z"), c("b", "u1", "2026-11-03T11:00:00Z")];
    expect(copiasRepetidas(cons, new Map([["a", ["GUJO"]], ["b", ["DHDCF"]]]), agora)).toEqual([]);
  });
  it("different vendors are never mixed", () => {
    const cons = [c("a", "u1", "2026-11-03T10:00:00Z"), c("b", "u2", "2026-11-03T11:00:00Z")];
    expect(copiasRepetidas(cons, new Map([["a", ["X"]], ["b", ["X"]]]), agora)).toEqual([]);
  });
  it("leaves alone a connection made in the last 10 minutes or without accounts yet", () => {
    const cons = [c("a", "u1", "2026-11-03T10:00:00Z"), c("b", "u1", "2026-11-04T11:55:00Z"), c("d", "u1", "2026-11-03T10:05:00Z")];
    expect(copiasRepetidas(cons, new Map([["a", ["X"]], ["b", ["X"]]]), agora)).toEqual([]);
  });

  // ---- A4 (12/11): distinct accounts of the same institution are never treated as copies
  it("personal and business accounts at the same bank (CPF and CNPJ) both stay, even with the same account names", () => {
    const cons = [c("pf", "u1", "2026-11-03T10:00:00Z", "Nubank", "Joao Silva", { dono_doc: CPF }),
      c("pj", "u1", "2026-11-03T11:00:00Z", "Nubank", "Joao Silva", { dono_doc: CNPJ })];
    expect(copiasRepetidas(cons, new Map([["pf", ["Conta Corrente"]], ["pj", ["Conta Corrente"]]]), agora)).toEqual([]);
  });
  it("two companies of the same seller at the same bank both stay", () => {
    const cons = [c("a", "u1", "2026-11-03T10:00:00Z", "Cora", null, { dono_doc: CNPJ }),
      c("b", "u1", "2026-11-03T11:00:00Z", "Cora", null, { dono_doc: "98765432000155" })];
    expect(copiasRepetidas(cons, new Map([["a", ["Conta"]], ["b", ["Conta"]]]), agora)).toEqual([]);
  });
  it("same bank and same account names but nobody identified as the holder: no proof, both stay", () => {
    const cons = [c("a", "u1", "2026-11-03T10:00:00Z", "Nubank", null), c("b", "u1", "2026-11-03T11:00:00Z", "Nubank", "  ")];
    expect(copiasRepetidas(cons, new Map([["a", ["Conta Corrente"]], ["b", ["Conta Corrente"]]]), agora)).toEqual([]);
  });
  it("the holder known on one side only is not proof either", () => {
    const cons = [c("a", "u1", "2026-11-03T10:00:00Z", "Nubank", "Joao", { dono_doc: CPF }), c("b", "u1", "2026-11-03T11:00:00Z", "Nubank", "Joao")];
    expect(copiasRepetidas(cons, new Map([["a", ["Conta"]], ["b", ["Conta"]]]), agora)).toEqual([]);
  });
  it("the same document proves the holder even when the name was written differently", () => {
    const cons = [c("a", "u1", "2026-11-03T10:00:00Z", "Mercado Pago", "JOAO DA SILVA", { dono_doc: CPF }),
      c("b", "u1", "2026-11-03T10:00:20Z", "Mercado Pago", "Joao Silva", { dono_doc: "123.456.789-01" })];
    expect(copiasRepetidas(cons, new Map([["a", ["DHDCF"]], ["b", ["DHDCF"]]]), agora)).toEqual(["b"]);
  });
  it("the one that would stay is broken: nothing is removed, the working connection is never the one to go", () => {
    for (const quebrada of ["LOGIN_ERROR", "OUTDATED", "USER_INPUT_TIMEOUT", "WAITING_USER_INPUT", "UPDATING", "", null]) {
      const cons = [c("velha", "u1", "2026-11-01T10:00:00Z", "Cora", "Joao", { dono_doc: CPF, status: quebrada }),
        c("nova", "u1", "2026-11-03T10:00:00Z", "Cora", "Joao", { dono_doc: CPF })];
      expect(copiasRepetidas(cons, new Map([["velha", ["Conta"]], ["nova", ["Conta"]]]), agora)).toEqual([]);
    }
  });
  it("the oldest works and a newer copy is broken: the copy goes", () => {
    const cons = [c("velha", "u1", "2026-11-01T10:00:00Z", "Cora", "Joao", { dono_doc: CPF }),
      c("nova", "u1", "2026-11-03T10:00:00Z", "Cora", "Joao", { dono_doc: CPF, status: "LOGIN_ERROR" })];
    expect(copiasRepetidas(cons, new Map([["velha", ["Conta"]], ["nova", ["Conta"]]]), agora)).toEqual(["nova"]);
  });
  it("titularDe: document first, then the name, else nothing", () => {
    expect(titularDe({ dono_doc: "123.456.789-01", dono_nome: "Joao" })).toBe("doc:12345678901");
    expect(titularDe({ dono_doc: null, dono_nome: " Joao Silva " })).toBe("nome:joao silva");
    expect(titularDe({ dono_doc: "123", dono_nome: null })).toBe(""); // not a document
    expect(titularDe({ dono_doc: null, dono_nome: null })).toBe("");
  });
});
