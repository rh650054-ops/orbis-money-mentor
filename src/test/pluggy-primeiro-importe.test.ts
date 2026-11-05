import { describe, expect, it } from "vitest";
import { diasDoPrimeiroImporte } from "../../supabase/functions/_shared/pluggy-entradas";

describe("first bank read covers the whole month (Rick, 04/11)", () => {
  it("day 20 in Brasília → 20 days back", () => {
    expect(diasDoPrimeiroImporte(new Date("2026-11-20T15:00:00Z"))).toBe(20);
  });
  it("early in the month keeps at least 7 days", () => {
    expect(diasDoPrimeiroImporte(new Date("2026-11-03T15:00:00Z"))).toBe(7);
  });
  it("uses the Brasília day, not UTC (01:00 UTC on the 21st is still the 20th)", () => {
    expect(diasDoPrimeiroImporte(new Date("2026-11-21T01:00:00Z"))).toBe(20);
  });
});
