// @vitest-environment node
import { describe, expect, it } from "vitest";
import { diasDePro } from "./planos";

describe("dias de Vant Pro por compra", () => {
  it("ofertas conhecidas, incluindo o anual novo t9xt3k4z", () => {
    expect(diasDePro("5y86n311", "")).toBe(30);
    expect(diasDePro("ew11enu0", "")).toBe(365);
    expect(diasDePro("t9xt3k4z", "VANT Pro Anual")).toBe(365);
  });
  it("oferta nova cai pelo nome do plano; banco extra e assinatura comum não viram Pro", () => {
    expect(diasDePro("zzz", "VANT Pro Anual")).toBe(365);
    expect(diasDePro("zzz", "Vant Pro")).toBe(30);
    expect(diasDePro("3nnrr1xn", "Banco Open Finance:")).toBeNull();
    expect(diasDePro("abc", "Orbis")).toBeNull();
  });
});
