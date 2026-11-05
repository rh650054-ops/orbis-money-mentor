import { describe, expect, it } from "vitest";
import { chaveSumida, idsSumidos } from "../../supabase/functions/_shared/pluggy-entradas";

const k = (dia: string, v: number) => chaveSumida(dia, v);
const g = (id: string, dia: string, v: number) => ({ id, chave: k(dia, v) });

describe("idsSumidos", () => {
  it("removes an old id when Mercado Pago re-issued the same Pix with a new id", () => {
    const vistos = new Set(["novo-1", "igual"]);
    const porChave = new Map([[k("2026-11-01", 10), 1], [k("2026-11-01", 25), 1]]);
    expect(idsSumidos([g("velho-1", "2026-11-01", 10), g("igual", "2026-11-01", 25)], vistos, porChave)).toEqual(["velho-1"]);
  });

  it("keeps entries that vanished with no twin (partial read must not wipe the day)", () => {
    const vistos = new Set(["hoje"]);
    const porChave = new Map([[k("2026-11-03", 25), 1]]);
    const guardados = [g("a", "2026-11-01", 30), g("b", "2026-11-01", 30), g("hoje", "2026-11-03", 25)];
    expect(idsSumidos(guardados, vistos, porChave)).toEqual([]);
  });

  it("removes only as many as there are new twins", () => {
    const vistos = new Set(["n1"]);
    const porChave = new Map([[k("2026-11-01", 12), 1]]);
    expect(idsSumidos([g("v1", "2026-11-01", 12), g("v2", "2026-11-01", 12)], vistos, porChave)).toEqual(["v1"]);
  });

  it("keeps everything when every stored id came back", () => {
    const porChave = new Map([[k("2026-11-01", 5), 2]]);
    expect(idsSumidos([g("a", "2026-11-01", 5), g("b", "2026-11-01", 5)], new Set(["a", "b"]), porChave)).toEqual([]);
  });
});

import { apagarTransacoes } from "../../supabase/functions/_shared/pluggy-entradas";

describe("apagarTransacoes: only with a re-issued twin (audit OF1, 04/11)", () => {
  type Row = { transaction_id: string; amount: number; transaction_date: string; created_at: string };
  function adminFalso(rows: Row[]) {
    const apagados: string[] = [];
    const from = () => {
      let ids: string[] | null = null; let del = false; let depois = "";
      const q = {
        select: () => q, eq: () => q, delete: () => { del = true; return q; },
        in: (col: string, v: string[]) => { if (col === "transaction_id") ids = v; return q; },
        gt: (_c: string, v: string) => { depois = v; return q; },
        then(res: (r: { data: unknown; error: null }) => unknown) {
          if (del) { apagados.push(...(ids ?? [])); return Promise.resolve({ data: (ids ?? []).map((id) => ({ id })), error: null }).then(res); }
          const data = ids ? rows.filter((r) => ids!.includes(r.transaction_id)) : rows.filter((r) => r.created_at > depois);
          return Promise.resolve({ data, error: null }).then(res);
        },
      };
      return q;
    };
    return { admin: { from }, apagados };
  }
  const R = (id: string, v: number, at: string) => ({ transaction_id: id, amount: v, transaction_date: "2026-11-03", created_at: at });

  it("deletes the old id when the new copy is already stored", async () => {
    const f = adminFalso([R("old", 20, "2026-11-03T10:00"), R("new", 20, "2026-11-03T12:00")]);
    expect(await apagarTransacoes(f.admin, "c1", ["old"])).toBe(1);
    expect(f.apagados).toEqual(["old"]);
  });
  it("keeps a sale that Pluggy dropped with no twin", async () => {
    const f = adminFalso([R("old", 20, "2026-11-03T10:00"), R("other", 35, "2026-11-03T12:00")]);
    expect(await apagarTransacoes(f.admin, "c1", ["old"])).toBe(0);
    expect(f.apagados).toEqual([]);
  });
});
