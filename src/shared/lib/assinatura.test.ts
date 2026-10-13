import { describe, expect, it } from "vitest";
import { assinaturaAtiva, temAcessoPago } from "./assinatura";

const agora = new Date("2026-10-13T12:00:00Z");
const perfil = { plan_status: null, is_demo: false, billing_exempt: false };

describe("one 'active' rule for the gate and the 'Já paguei' check", () => {
  it("active without grace_until counts as paid (the modal used to say no)", () => {
    expect(assinaturaAtiva({ status: "active", grace_until: null }, agora)).toBe(true);
  });
  it("active past grace and past_due outside grace do not", () => {
    expect(assinaturaAtiva({ status: "active", grace_until: "2026-10-12T00:00:00Z" }, agora)).toBe(false);
    expect(assinaturaAtiva({ status: "past_due", grace_until: null }, agora)).toBe(false);
    expect(assinaturaAtiva({ status: "past_due", grace_until: "2026-10-20T00:00:00Z" }, agora)).toBe(true);
    expect(assinaturaAtiva({ status: "canceled", grace_until: "2026-10-20T00:00:00Z" }, agora)).toBe(false);
  });
  it("subscription row decides over a stale plan_status; demo always passes", () => {
    const ativo = { ...perfil, plan_status: "active" };
    expect(temAcessoPago(ativo, { status: "canceled", grace_until: null }, agora)).toBe(false);
    expect(temAcessoPago(ativo, null, agora)).toBe(true);
    expect(temAcessoPago({ ...perfil, is_demo: true, billing_exempt: true }, null, agora)).toBe(true);
    expect(temAcessoPago(null, { status: "active", grace_until: null }, agora)).toBe(false);
  });
});
