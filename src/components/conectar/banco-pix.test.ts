import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { pixQueEntraNoDia, horaDaLeitura } from "./banco-pix";

describe("pixQueEntraNoDia", () => {
  it("bank Pix fits inside what was sold", () => {
    expect(pixQueEntraNoDia(610, 880, 180, 90)).toEqual({ entra: 610, aMais: 0 });
  });
  it("Pix above the sales is reported apart, not as a sale", () => {
    expect(pixQueEntraNoDia(700, 880, 180, 90)).toEqual({ entra: 610, aMais: 90 });
  });
  it("less Pix than launched leaves room for the unpaid gap", () => {
    expect(pixQueEntraNoDia(400, 880, 180, 90)).toEqual({ entra: 400, aMais: 0 });
  });
  it("cash and card already cover the day", () => {
    expect(pixQueEntraNoDia(50, 200, 150, 60)).toEqual({ entra: 0, aMais: 50 });
  });
});

describe("horaDaLeitura", () => {
  it("shows Brasília time", () => {
    expect(horaDaLeitura("2026-10-02T16:40:00Z")).toBe("13:40");
    expect(horaDaLeitura(null)).toBe("");
  });
});
