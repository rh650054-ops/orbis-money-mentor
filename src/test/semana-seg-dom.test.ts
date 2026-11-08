import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));

import { currentWeekEnd, currentWeekStart, segundaDaSemana, semanaAnterior } from "../hooks/useWeeklyLeaderboard";
import { rotuloSemana } from "../components/ranking/premiacao";

describe("official week: Monday → Sunday from 02/11/2026 (Rick, 08/11)", () => {
  it("Sunday 08/11 still belongs to the week 02–08", () => {
    expect(currentWeekStart("2026-11-08")).toBe("2026-11-02");
    expect(currentWeekEnd("2026-11-08")).toBe("2026-11-08");
  });
  it("Monday 09/11 (even before 06:00) already belongs to 09–15", () => {
    expect(currentWeekStart("2026-11-09")).toBe("2026-11-09");
    expect(currentWeekEnd("2026-11-09")).toBe("2026-11-15");
  });
  it("November calendar: 02–08, 09–15, 16–22, 23–29", () => {
    for (const [d, ini, fim] of [["2026-11-04", "2026-11-02", "2026-11-08"], ["2026-11-15", "2026-11-09", "2026-11-15"],
      ["2026-11-18", "2026-11-16", "2026-11-22"], ["2026-11-29", "2026-11-23", "2026-11-29"], ["2026-11-30", "2026-11-30", "2026-12-06"]]) {
      expect([currentWeekStart(d!), currentWeekEnd(d!)]).toEqual([ini, fim]);
    }
  });
  it("before the cutover the old Sunday → Saturday week stays (history untouched)", () => {
    expect(currentWeekStart("2026-11-01")).toBe("2026-11-01");
    expect(currentWeekEnd("2026-11-01")).toBe("2026-11-07");
    expect(currentWeekStart("2026-10-28")).toBe("2026-10-25");
  });
  it("segundaDaSemana handles every weekday", () => {
    expect(segundaDaSemana("2026-11-09")).toBe("2026-11-09");
    expect(segundaDaSemana("2026-11-12")).toBe("2026-11-09");
    expect(segundaDaSemana("2026-11-15")).toBe("2026-11-09");
  });
  it("the result card shows the last closed week", () => {
    expect(semanaAnterior("2026-11-09")).toEqual({ inicio: "2026-11-02", fim: "2026-11-08" });
    expect(semanaAnterior("2026-11-15")).toEqual({ inicio: "2026-11-02", fim: "2026-11-08" });
    expect(semanaAnterior("2026-11-16")).toEqual({ inicio: "2026-11-09", fim: "2026-11-15" });
  });
  it("week labels count from 02/11", () => {
    expect(rotuloSemana("2026-11-02", "2026-11-08")).toBe("Semana 1 · 02/11 a 08/11");
    expect(rotuloSemana("2026-11-09", "2026-11-15")).toBe("Semana 2 · 09/11 a 15/11");
    expect(rotuloSemana("2026-11-23", "2026-11-29")).toBe("Semana 4 · 23/11 a 29/11");
    expect(rotuloSemana("2026-11-30", "2026-12-06")).toBe("Semana 5 · 30/11 a 06/12");
  });
});
