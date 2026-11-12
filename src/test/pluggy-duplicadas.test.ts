// The robot's "repeated copies" routine (pluggy-duplicadas.ts).
// A4 (12/11): it removes NOTHING. Same bank + same holder + same account names is not an
// unequivocal identification of one bank account, so what looks like a copy is only reported.
import { afterEach, describe, expect, it, vi } from "vitest";
import { diagnosticoDeCopias, limparRepetidas, possiveisCopias, titularDe, type Conexao } from "../../supabase/functions/_shared/pluggy-duplicadas";

const agora = Date.parse("2026-11-04T12:00:00Z");
const c = (id: string, user: string, criada: string, banco = "Mercado Pago", dono: string | null = "Joao", extra: Partial<Conexao> = {}): Conexao =>
  ({ id, user_id: user, institution_name: banco, dono_nome: dono, created_at: criada, dono_doc: null, status: "UPDATED", ...extra });
const CPF = "12345678901";
const CNPJ = "12345678000199";
const ids = (grupos: Conexao[][]) => grupos.map((g) => g.map((x) => x.id));

describe("possiveisCopias — a diagnosis, never a proof", () => {
  it("same seller, bank, holder and account names: reported as one group, oldest first", () => {
    const cons = [c("b", "u1", "2026-11-03T18:44:38Z"), c("a", "u1", "2026-11-03T18:44:25Z"), c("c", "u1", "2026-11-03T18:44:50Z")];
    const contas = new Map([["a", ["DHDCF"]], ["b", ["DHDCF"]], ["c", ["DHDCF"]]]);
    expect(ids(possiveisCopias(cons, contas, agora))).toEqual([["a", "b", "c"]]);
  });
  it("different account names, different sellers, a CPF and a CNPJ: not even a suspicion", () => {
    expect(possiveisCopias([c("a", "u1", "2026-11-03T10:00:00Z"), c("b", "u1", "2026-11-03T11:00:00Z")],
      new Map([["a", ["GUJO"]], ["b", ["DHDCF"]]]), agora)).toEqual([]);
    expect(possiveisCopias([c("a", "u1", "2026-11-03T10:00:00Z"), c("b", "u2", "2026-11-03T11:00:00Z")],
      new Map([["a", ["X"]], ["b", ["X"]]]), agora)).toEqual([]);
    expect(possiveisCopias([c("pf", "u1", "2026-11-03T10:00:00Z", "Nubank", "Joao Silva", { dono_doc: CPF }),
      c("pj", "u1", "2026-11-03T11:00:00Z", "Nubank", "Joao Silva", { dono_doc: CNPJ })],
      new Map([["pf", ["Conta Corrente"]], ["pj", ["Conta Corrente"]]]), agora)).toEqual([]);
  });
  it("nobody identified as the holder, or on one side only: not reported", () => {
    const contas = new Map([["a", ["Conta Corrente"]], ["b", ["Conta Corrente"]]]);
    expect(possiveisCopias([c("a", "u1", "2026-11-03T10:00:00Z", "Nubank", null), c("b", "u1", "2026-11-03T11:00:00Z", "Nubank", "  ")], contas, agora)).toEqual([]);
    expect(possiveisCopias([c("a", "u1", "2026-11-03T10:00:00Z", "Nubank", "Joao", { dono_doc: CPF }), c("b", "u1", "2026-11-03T11:00:00Z", "Nubank", "Joao")], contas, agora)).toEqual([]);
  });
  it("leaves out a connection made in the last 10 minutes or without accounts yet", () => {
    const cons = [c("a", "u1", "2026-11-03T10:00:00Z"), c("b", "u1", "2026-11-04T11:55:00Z"), c("d", "u1", "2026-11-03T10:05:00Z")];
    expect(possiveisCopias(cons, new Map([["a", ["X"]], ["b", ["X"]]]), agora)).toEqual([]);
  });
  it("titularDe: document first, then the name, else nothing", () => {
    expect(titularDe({ dono_doc: "123.456.789-01", dono_nome: "Joao" })).toBe("doc:12345678901");
    expect(titularDe({ dono_doc: null, dono_nome: " Joao Silva " })).toBe("nome:joao silva");
    expect(titularDe({ dono_doc: "123", dono_nome: null })).toBe(""); // not a document
    expect(titularDe({ dono_doc: null, dono_nome: null })).toBe("");
  });
  it("the log line carries counts only", () => {
    const g = possiveisCopias([c("a", "u1", "2026-11-03T10:00:00Z", "Cora", "Joao", { dono_doc: CPF }),
      c("b", "u1", "2026-11-03T11:00:00Z", "Cora", "Joao", { dono_doc: CPF, status: "LOGIN_ERROR" })],
      new Map([["a", ["Conta"]], ["b", ["Conta"]]]), agora);
    const d = diagnosticoDeCopias(g);
    expect(d).toEqual({ grupos: 1, conexoes: 2, por_documento: 1, saudaveis: 1 });
    expect(JSON.stringify(d)).not.toMatch(/Joao|12345678901|u1|Cora/);
  });
});

// ---- the routine itself, over a fake database: whatever it finds, it removes nothing
function bancoFalso(conexoes: (Conexao & { item_id: string })[], saldos: { bank_connection_id: string; nome: string }[]) {
  const escritas: string[] = [];
  const admin = {
    from: (tabela: string) => ({
      select: () => tabela === "bank_connections"
        ? { neq: async () => ({ data: conexoes, error: null }) }
        : { in: async () => ({ data: saldos, error: null }) },
      update: () => { escritas.push(`update ${tabela}`); return { eq: async () => ({ error: null }) }; },
      delete: () => { escritas.push(`delete ${tabela}`); return { eq: async () => ({ error: null }) }; },
      upsert: async () => { escritas.push(`upsert ${tabela}`); return { error: null }; },
    }),
  };
  return { admin, escritas };
}

describe("limparRepetidas — A4: no connection is removed without an unequivocal identification of the account", () => {
  afterEach(() => vi.restoreAllMocks());
  const velho = "2026-10-01T10:00:00Z";

  it("one person, same CPF, same bank, same account name (two checking accounts): both stay", async () => {
    const rede = vi.spyOn(globalThis, "fetch");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const chave = vi.fn(async () => "api-key");
    const b = bancoFalso(
      [{ ...c("a", "u1", velho, "Nubank", "Joao Silva", { dono_doc: CPF }), item_id: "it-a" },
        { ...c("b", "u1", "2026-10-02T10:00:00Z", "Nubank", "Joao Silva", { dono_doc: CPF }), item_id: "it-b" }],
      [{ bank_connection_id: "a", nome: "Conta Corrente" }, { bank_connection_id: "b", nome: "Conta Corrente" }]);
    expect(await limparRepetidas(b.admin, chave)).toBe(0);
    expect(b.escritas).toEqual([]); // nothing marked deleted, nothing written
    expect(rede).not.toHaveBeenCalled(); // no Item deleted on Pluggy
    expect(chave).not.toHaveBeenCalled(); // Pluggy is not even authenticated
    expect(log).toHaveBeenCalledWith("pluggy duplicadas: possiveis copias mantidas, sem identificacao inequivoca da conta",
      JSON.stringify({ grupos: 1, conexoes: 2, por_documento: 1, saudaveis: 2 }));
  });
  it("the Mercado Pago loop (four Items, same holder, same accounts): the four stay, and it is reported", async () => {
    const rede = vi.spyOn(globalThis, "fetch");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const cons = ["a", "b", "c", "d"].map((id, i) => ({ ...c(id, "u1", `2026-10-0${i + 1}T10:00:00Z`, "Mercado Pago", "Joao", { dono_doc: CPF }), item_id: `it-${id}` }));
    const b = bancoFalso(cons, cons.map((x) => ({ bank_connection_id: x.id, nome: "DHDCF" })));
    expect(await limparRepetidas(b.admin, async () => "api-key")).toBe(0);
    expect(b.escritas).toEqual([]);
    expect(rede).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
  });
  it("nothing that looks like a copy: nothing is written and nothing is logged", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const b = bancoFalso(
      [{ ...c("a", "u1", velho, "Nubank", "Joao", { dono_doc: CPF }), item_id: "it-a" },
        { ...c("b", "u1", velho, "Nubank", "Joao LTDA", { dono_doc: CNPJ }), item_id: "it-b" }],
      [{ bank_connection_id: "a", nome: "Conta Corrente" }, { bank_connection_id: "b", nome: "Conta Corrente" }]);
    expect(await limparRepetidas(b.admin)).toBe(0);
    expect(b.escritas).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });
});
