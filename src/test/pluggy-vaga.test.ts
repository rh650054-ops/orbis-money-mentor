import { describe, expect, it } from "vitest";
import { cabeNoPlano, decidirVaga, doMesmoBanco, limiteDoPlano, vagaParaBanco, type Ativa } from "../../supabase/functions/_shared/pluggy-vaga";

const a = (id: string, banco: string, criada: string, item = `it-${id}`): Ativa => ({ id, item_id: item, institution_name: banco, created_at: criada });

describe("doMesmoBanco (A4: same institution is noted, never a reason to delete)", () => {
  it("finds the seller's other connections at the same institution, not the Item itself", () => {
    const l = [a("1", "Nubank", "2026-10-07T00:00:00Z"), a("2", "nubank ", "2026-10-17T00:00:00Z"), a("3", "Nubank Empresas", "2026-10-18T00:00:00Z")];
    expect(doMesmoBanco(l, "Nubank", "novo").map((x) => x.id)).toEqual(["1", "2"]);
    expect(doMesmoBanco(l, "Nubank", "it-1").map((x) => x.id)).toEqual(["2"]);
    expect(doMesmoBanco(l, "Itaú", "novo")).toEqual([]);
    expect(doMesmoBanco(l, null, "novo")).toEqual([]);
  });
});

describe("cabeNoPlano (every live connection takes a slot; Pro monthly = 1 bank)", () => {
  it("Pro monthly with Nubank: a second bank does not fit", () => {
    expect(cabeNoPlano([a("1", "Nubank", "2026-10-01T00:00:00Z")], "novo", 1)).toBe(false);
  });
  it("A4: Pro monthly with Nubank: another Nubank Item is another connection and does not fit either", () => {
    expect(cabeNoPlano([a("1", "Nubank", "2026-10-01T00:00:00Z")], "novo", 1)).toBe(false);
  });
  it("A4: two slots and one Nubank: a second Nubank account (personal + business) fits", () => {
    expect(cabeNoPlano([a("1", "Nubank", "2026-10-01T00:00:00Z")], "novo", 2)).toBe(true);
    expect(cabeNoPlano([a("1", "Nubank", "x"), a("2", "Nubank", "x")], "novo", 2)).toBe(false);
  });
  it("the item being saved never counts against itself", () => {
    expect(cabeNoPlano([a("1", "Itaú", "2026-11-09T00:00:00Z", "novo")], "novo", 1)).toBe(true);
  });
  it("annual (2 banks) with one bank: a second fits", () => {
    expect(cabeNoPlano([a("1", "Nubank", "2026-10-01T00:00:00Z")], "novo", 2)).toBe(true);
  });
  it("no plan (limit 0): nothing fits", () => {
    expect(cabeNoPlano([], "novo", 0)).toBe(false);
  });
  it("exempt (limit null) always fits", () => {
    expect(cabeNoPlano([a("1", "Nubank", "x"), a("2", "C6", "x")], "novo", null)).toBe(true);
  });
});

// ---- 12/11 (A2): a limit that could not be read no longer lets a new connection in
describe("limiteDoPlano (reads open_finance_limite's answer)", () => {
  it("a numeric limit is the limit", () => {
    expect(limiteDoPlano({ usados: 1, isento: false, limite: 1, pode_conectar: false })).toBe(1);
    expect(limiteDoPlano({ isento: false, limite: 0 })).toBe(0); // no plan: really zero banks
    expect(limiteDoPlano({ isento: false, limite: 3 })).toBe(3);
  });
  it("exempt sellers have no limit", () => {
    expect(limiteDoPlano({ isento: true, limite: null })).toBeNull();
  });
  it("anything else cannot be told — and is never read as zero", () => {
    for (const ruim of [null, undefined, "", "1", 1, [], [{ limite: 1 }], {}, { isento: false }, { isento: false, limite: null },
      { isento: false, limite: "2" }, { isento: false, limite: -1 }, { isento: false, limite: 1.5 }, { isento: false, limite: Number.NaN }]) {
      expect(limiteDoPlano(ruim)).toBeUndefined();
    }
  });
});

describe("decidirVaga (cabe / sem_vaga / indisponivel)", () => {
  const nubank = [a("1", "Nubank", "2026-10-01T00:00:00Z", "it-nu")];
  it("limit known and free: cabe", () => {
    expect(decidirVaga({ ativas: [], limite: 1, itemId: "novo" })).toBe("cabe");
    expect(decidirVaga({ ativas: nubank, limite: 2, itemId: "novo" })).toBe("cabe");
    expect(decidirVaga({ ativas: nubank, limite: null, itemId: "novo" })).toBe("cabe");
  });
  it("limit known and exceeded: sem_vaga", () => {
    expect(decidirVaga({ ativas: nubank, limite: 1, itemId: "novo" })).toBe("sem_vaga");
    expect(decidirVaga({ ativas: [], limite: 0, itemId: "novo" })).toBe("sem_vaga");
  });
  it("limit not readable: indisponivel, even when the seller has no bank at all", () => {
    expect(decidirVaga({ ativas: [], limite: undefined, itemId: "novo" })).toBe("indisponivel");
    expect(decidirVaga({ ativas: nubank, limite: undefined, itemId: "novo" })).toBe("indisponivel");
  });
  it("connections not readable: indisponivel, whatever the limit says", () => {
    for (const limite of [0, 1, 5, null, undefined]) {
      expect(decidirVaga({ ativas: null, limite, itemId: "novo" })).toBe("indisponivel");
    }
  });
  it("an Item that is already the seller's live connection always fits, with or without a limit", () => {
    const duas = [...nubank, a("2", "Itaú", "2026-10-02T00:00:00Z", "it-itau")];
    for (const limite of [0, 1, null, undefined]) {
      expect(decidirVaga({ ativas: duas, limite, itemId: "it-itau" })).toBe("cabe");
    }
  });
});

type Passo<T> = T | "erro" | "excecao";
function adminFalso(roteiro: { ativas: Passo<Ativa[]>[]; limite: Passo<unknown>[] }) {
  const chamadas = { ativas: 0, limite: 0 };
  const proximo = <T,>(l: Passo<T>[], n: number): Passo<T> => l[Math.min(n, l.length - 1)] as Passo<T>;
  const resposta = <T,>(r: Passo<T>) => {
    if (r === "excecao") throw new Error("rede caiu");
    return r === "erro" ? { data: null, error: { message: "timeout" } } : { data: r, error: null };
  };
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ neq: async () => resposta(proximo(roteiro.ativas, chamadas.ativas++)) }) }),
    }),
    rpc: async () => resposta(proximo(roteiro.limite, chamadas.limite++)),
  };
  return { admin, chamadas };
}
const mensal = { isento: false, limite: 1 };
const rapido = { esperaMs: 0 };

describe("vagaParaBanco (the real function over a fake database)", () => {
  const nubank = [a("1", "Nubank", "2026-10-01T00:00:00Z", "it-nu")];
  it("everything readable: cabe / sem_vaga as the plan says", async () => {
    expect(await vagaParaBanco(adminFalso({ ativas: [[]], limite: [mensal] }).admin, "u", "Nubank", "novo", rapido)).toBe("cabe");
    expect(await vagaParaBanco(adminFalso({ ativas: [nubank], limite: [mensal] }).admin, "u", "Itaú", "novo", rapido)).toBe("sem_vaga");
    expect(await vagaParaBanco(adminFalso({ ativas: [nubank], limite: [{ isento: true, limite: null }] }).admin, "u", "Itaú", "novo", rapido)).toBe("cabe");
  });
  it("A4: the same bank again is another connection — refused at the limit, accepted with a free slot", async () => {
    expect(await vagaParaBanco(adminFalso({ ativas: [nubank], limite: [mensal] }).admin, "u", "Nubank", "novo", rapido)).toBe("sem_vaga");
    expect(await vagaParaBanco(adminFalso({ ativas: [nubank], limite: [{ isento: false, limite: 2 }] }).admin, "u", "Nubank", "novo", rapido)).toBe("cabe");
  });
  it("the limit query fails twice: indisponivel (it used to let the bank in)", async () => {
    for (const falha of ["erro", "excecao"] as const) {
      const f = adminFalso({ ativas: [[]], limite: [falha] });
      expect(await vagaParaBanco(f.admin, "u", "Itaú", "novo", rapido)).toBe("indisponivel");
      expect(f.chamadas.limite).toBe(2); // asked again once before giving up
    }
  });
  it("the limit comes back empty or without a number: indisponivel, never 'zero banks'", async () => {
    for (const ruim of [null, {}, { isento: false, limite: null }, { isento: false }]) {
      expect(await vagaParaBanco(adminFalso({ ativas: [nubank], limite: [ruim] }).admin, "u", "Itaú", "novo", rapido)).toBe("indisponivel");
    }
  });
  it("the connections query fails twice: indisponivel (it used to count as 'no bank')", async () => {
    for (const falha of ["erro", "excecao"] as const) {
      const f = adminFalso({ ativas: [falha], limite: [mensal] });
      expect(await vagaParaBanco(f.admin, "u", "Itaú", "novo", rapido)).toBe("indisponivel");
      expect(f.chamadas.ativas).toBe(2);
      expect(f.chamadas.limite).toBe(0); // nothing else is asked
    }
  });
  it("a failure that passes on the second try is not a refusal", async () => {
    const f = adminFalso({ ativas: ["erro", []], limite: ["excecao", mensal] });
    expect(await vagaParaBanco(f.admin, "u", "Nubank", "novo", rapido)).toBe("cabe");
    expect(f.chamadas).toMatchObject({ ativas: 2, limite: 2 });
    const g = adminFalso({ ativas: [nubank], limite: ["erro", mensal] });
    expect(await vagaParaBanco(g.admin, "u", "Itaú", "novo", rapido)).toBe("sem_vaga"); // exceeded stays exceeded
  });
  it("an Item that is already connected fits without the limit being asked at all", async () => {
    const f = adminFalso({ ativas: [nubank], limite: ["erro"] });
    expect(await vagaParaBanco(f.admin, "u", "Nubank", "it-nu", rapido)).toBe("cabe");
    expect(f.chamadas.limite).toBe(0);
  });
  it("by default it waits a little between the two tries", async () => {
    const f = adminFalso({ ativas: ["erro", []], limite: [mensal] });
    const t0 = Date.now();
    expect(await vagaParaBanco(f.admin, "u", "Nubank", "novo")).toBe("cabe");
    expect(Date.now() - t0).toBeGreaterThanOrEqual(250);
  });
});
