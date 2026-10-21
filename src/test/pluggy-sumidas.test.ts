import { describe, expect, it } from "vitest";
import { idsSumidos } from "../../supabase/functions/_shared/pluggy-entradas";

describe("idsSumidos", () => {
  it("returns stored ids that Pluggy no longer returns (Mercado Pago re-issued Pix)", () => {
    const vistos = new Set(["novo-1", "novo-2", "igual"]);
    expect(idsSumidos(["velho-1", "igual", "velho-2"], vistos)).toEqual(["velho-1", "velho-2"]);
  });
  it("keeps everything when every stored id came back", () => {
    expect(idsSumidos(["a", "b"], new Set(["a", "b", "c"]))).toEqual([]);
  });
});
