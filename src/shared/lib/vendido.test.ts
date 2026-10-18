import { describe, it, expect } from "vitest";
import { vendidoDoDia, vendidoTotal } from "./vendido";

describe("vendidoDoDia", () => {
  it("sold = what fell + what is still missing", () => {
    expect(vendidoDoDia({ total_profit: 132, total_debt: 173 })).toBe(305);
    expect(vendidoDoDia({ total_profit: "496.00", total_debt: "85.00" })).toBe(581);
  });
  it("tolerates nulls and missing rows", () => {
    expect(vendidoDoDia({ total_profit: null, total_debt: null })).toBe(0);
    expect(vendidoDoDia(null)).toBe(0);
  });
  it("sums rows without float noise", () => {
    expect(vendidoTotal([{ total_profit: 10.7, total_debt: 0 }, { total_profit: 5.6, total_debt: 0 }])).toBe(16.3);
  });
});
