import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { divisaoPote, ordenarPlacar, type SalaLutador } from "./x1-sala-lib";

const lut = (id: string, total: number, status: SalaLutador["status"] = "dentro"): SalaLutador => ({
  user_id: id, status, nome: id, avatar: null, patente: "NOVATO", total, posicao: null, premio: 0, convidado_por: null,
});

describe("divisaoPote", () => {
  it("2 fighters: winner takes the pot minus 10%", () => {
    expect(divisaoPote(20, 2)).toEqual({ pote: 36, casa: 4, primeiro: 36, segundo: 0 });
  });
  it("4 fighters at R$20: R$72 pot, 70/30", () => {
    expect(divisaoPote(20, 4)).toEqual({ pote: 72, casa: 8, primeiro: 50.4, segundo: 21.6 });
  });
  it("honor room has no money", () => {
    expect(divisaoPote(0, 6)).toEqual({ pote: 0, casa: 0, primeiro: 0, segundo: 0 });
  });
});

describe("ordenarPlacar", () => {
  it("orders by total, ties share the position, ignores who is not in", () => {
    const r = ordenarPlacar([lut("a", 300), lut("b", 640), lut("c", 300), lut("d", 999, "convidado"), lut("e", 0)]);
    expect(r.map((x) => [x.user_id, x.pos])).toEqual([["b", 1], ["a", 2], ["c", 2], ["e", 4]]);
  });
});
