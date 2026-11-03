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
