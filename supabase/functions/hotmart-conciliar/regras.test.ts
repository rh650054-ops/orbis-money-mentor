import { describe, expect, it } from "vitest";
import { decidir } from "./regras";

const agora = new Date("2026-11-26T12:00:00Z");
const depois = agora.getTime() + 20 * 86_400_000;
const base = { subscription_id: "S1", status_hotmart: "PAST_DUE", oferta_codigo: "8qbxvm9p", plano: "VANT", email: "ze@exemplo.com" };
const EM = "Ze@Exemplo.com ";

describe("hotmart-conciliar (26/11)", () => {
  it("paid at Hotmart (ACTIVE, next charge ahead) and blocked here: release until the next charge", () => {
    expect(decidir(base, { status: "ACTIVE", date_next_charge: depois, email: EM }, false, agora))
      .toEqual({ gravarStatus: "ACTIVE", liberarAte: new Date(depois).toISOString(), proAte: null });
  });
  it("Pro offer: the Pro comes back too, with the same 3-day grace as the webhook", () => {
    const d = decidir({ ...base, oferta_codigo: "5y86n311" }, { status: "ACTIVE", date_next_charge: depois, email: EM }, false, agora);
    expect(d.proAte).toBe(new Date(depois + 3 * 86_400_000).toISOString());
  });
  it("still overdue: nothing released, status unchanged", () => {
    expect(decidir(base, { status: "PAST_DUE", date_next_charge: depois }, false, agora)).toEqual({ gravarStatus: null, liberarAte: null, proAte: null });
  });
  it("cancelled at Hotmart (our record was stale): only the status is recorded → the path becomes a new checkout", () => {
    expect(decidir(base, { status: "CANCELLED_BY_CUSTOMER", date_next_charge: null }, false, agora).gravarStatus).toBe("CANCELLED_BY_CUSTOMER");
  });
  it("repeated check / already released: never applies twice", () => {
    expect(decidir({ ...base, status_hotmart: "ACTIVE" }, { status: "ACTIVE", date_next_charge: depois, email: EM }, true, agora))
      .toEqual({ gravarStatus: null, liberarAte: null, proAte: null });
  });
  it("ACTIVE but the next charge is in the past: not proof of payment, nothing released", () => {
    expect(decidir(base, { status: "ACTIVE", date_next_charge: agora.getTime() - 1000, email: EM }, false, agora).liberarAte).toBeNull();
  });
  it("titularidade: paid, but Hotmart shows another subscriber (or no e-mail): nothing released", () => {
    expect(decidir(base, { status: "ACTIVE", date_next_charge: depois, email: "outra@exemplo.com" }, false, agora).liberarAte).toBeNull();
    expect(decidir(base, { status: "ACTIVE", date_next_charge: depois, email: null }, false, agora).liberarAte).toBeNull();
    expect(decidir({ ...base, email: null }, { status: "ACTIVE", date_next_charge: depois, email: EM }, false, agora).liberarAte).toBeNull();
  });
  it("PAST_DUE here and DELAYED at Hotmart are the same overdue state: nothing to record", () => {
    expect(decidir(base, { status: "DELAYED", date_next_charge: depois, email: EM }, false, agora).gravarStatus).toBeNull();
  });
});
