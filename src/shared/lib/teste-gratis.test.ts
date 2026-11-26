import { describe, expect, it } from "vitest";
import { fimDoTeste3Dias } from "./teste-gratis";

describe("3-day test (26/11)", () => {
  it("sign-up day in Brasília + 3, until 23:59", () => {
    expect(fimDoTeste3Dias(new Date("2026-11-26T15:00:00-03:00"))).toBe("29/11");
    // 23:30 in Brasília is already the next day in UTC: the Brazilian date counts
    expect(fimDoTeste3Dias(new Date("2026-11-26T23:30:00-03:00"))).toBe("29/11");
    expect(fimDoTeste3Dias(new Date("2026-12-30T10:00:00-03:00"))).toBe("02/01");
  });
});
