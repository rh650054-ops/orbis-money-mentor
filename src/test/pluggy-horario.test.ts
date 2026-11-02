import { describe, expect, it } from "vitest";
import { horasAtrasoDoBanco, quandoFoi } from "../../supabase/functions/_shared/pluggy-entradas";

const agora = Date.parse("2026-11-02T12:00:00Z");

describe("PagBank time fix", () => {
  it("only PagBank is shifted", () => {
    expect(horasAtrasoDoBanco("PagBank")).toBe(6);
    expect(horasAtrasoDoBanco("PagBank Empresas")).toBe(6);
    expect(horasAtrasoDoBanco("Nubank")).toBe(0);
    expect(horasAtrasoDoBanco(null)).toBe(0);
  });
  it("a Pix stored as 18:41 BRT of day 1 is really 00:41 of day 2", () => {
    const q = quandoFoi({ date: "2026-11-01T21:41:28.000Z" }, 6, agora);
    expect(q).toEqual({ dia: "2026-11-02", instante: "2026-11-02T03:41:28.000Z" });
  });
  it("a morning Pix stops looking like 5 a.m.", () => {
    expect(quandoFoi({ date: "2026-11-01T08:22:41.000Z" }, 6, agora).instante).toBe("2026-11-01T14:22:41.000Z");
  });
  it("keeps the time when the shift would land in the future (bank already fixed)", () => {
    const q = quandoFoi({ date: "2026-11-02T11:58:00.000Z" }, 6, agora);
    expect(q.instante).toBe("2026-11-02T11:58:00.000Z");
  });
  it("date-only entries and other banks are untouched", () => {
    expect(quandoFoi({ date: "2026-11-01T00:00:00.000Z" }, 6, agora)).toEqual({ dia: "2026-11-01", instante: null });
    expect(quandoFoi({ date: "2026-11-01T14:00:00.000Z" }, 0, agora).instante).toBe("2026-11-01T14:00:00.000Z");
  });
});
