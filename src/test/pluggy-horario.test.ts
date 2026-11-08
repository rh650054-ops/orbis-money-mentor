import { describe, expect, it } from "vitest";
import { horasAtrasoDoBanco, quandoFoi } from "../../supabase/functions/_shared/pluggy-entradas";

const agora = Date.parse("2026-11-02T12:00:00Z");

describe("PagBank time fix", () => {
  it("only PagBank (6h) and Cora (3h) are shifted", () => {
    expect(horasAtrasoDoBanco("PagBank")).toBe(6);
    expect(horasAtrasoDoBanco("PagBank Empresas")).toBe(6);
    expect(horasAtrasoDoBanco("Cora")).toBe(3);
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

describe("Cora time fix (08/11)", () => {
  it("a Pix stored as 03:41 BRT is really 06:41 BRT, same day", () => {
    const q = quandoFoi({ date: "2026-11-07T06:41:00.000Z" }, 3, Date.parse("2026-11-07T15:58:00Z"));
    expect(q).toEqual({ dia: "2026-11-07", instante: "2026-11-07T09:41:00.000Z" });
  });
  it("a Pix at 22:30 BRT moves to 01:30 of the next day", () => {
    const q = quandoFoi({ date: "2026-11-07T01:30:00.000Z" }, 3, Date.parse("2026-11-07T15:58:00Z"));
    expect(q).toEqual({ dia: "2026-11-07", instante: "2026-11-07T04:30:00.000Z" });
  });
});
