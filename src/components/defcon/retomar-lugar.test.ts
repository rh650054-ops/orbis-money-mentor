import { describe, expect, it } from "vitest";
import { conferirLugar } from "./retomar-lugar";

describe("conferirLugar", () => {
  it("remembers the best position of the day", () => {
    expect(conferirLugar(null, 14)).toEqual({ melhor: 14, caiu: 0 });
    expect(conferirLugar(14, 12)).toEqual({ melhor: 12, caiu: 0 });
  });
  it("flags when someone passed the seller", () => {
    expect(conferirLugar(12, 14)).toEqual({ melhor: 12, caiu: 2 });
  });
  it("ignores a missing position", () => {
    expect(conferirLugar(12, null)).toEqual({ melhor: 12, caiu: 0 });
  });
});
