import { describe, expect, it } from "vitest";
import { carimboDeLeitura, coberturaDoItem } from "../../supabase/functions/_shared/pluggy-cobertura";

// F-02 (audit 10/11/2026). Times in UTC; 03:00Z is midnight in Brasília.
describe("bank-read stamp = Pluggy's last real sync with the bank (F-02)", () => {
  const agora = new Date("2026-11-10T19:30:00Z"); // 10/11 16:30 BRT, when we read Pluggy

  it("the proven case: item OUTDATED since 09/11 08:57, read at 10/11 16:30 → no stamp", () => {
    const item = { status: "OUTDATED", lastUpdatedAt: "2026-11-09T11:57:00Z" };
    expect(coberturaDoItem(item, agora)).toBeNull();
    expect(carimboDeLeitura({ completa: true, item, atual: "2026-11-09T11:57:00Z", agora })).toBeNull();
  });

  it("healthy item synced at 15:00, read at 16:30 → stamped 15:00, not 16:30", () => {
    const item = { status: "UPDATED", lastUpdatedAt: "2026-11-10T18:00:00Z" };
    expect(carimboDeLeitura({ completa: true, item, atual: "2026-11-10T12:00:00Z", agora })).toBe("2026-11-10T18:00:00.000Z");
  });

  it("reading Pluggy after midnight does not check yesterday if Pluggy last synced before midnight", () => {
    const depoisDaMeiaNoite = new Date("2026-11-11T03:10:00Z"); // 11/11 00:10 BRT
    const item = { status: "UPDATED", lastUpdatedAt: "2026-11-11T01:40:00Z" }; // 10/11 22:40 BRT
    const carimbo = carimboDeLeitura({ completa: true, item, atual: null, agora: depoisDaMeiaNoite });
    expect(carimbo).toBe("2026-11-11T01:40:00.000Z");
    expect(Date.parse(carimbo!)).toBeLessThan(Date.parse("2026-11-11T03:00:00Z")); // before the day closed
  });

  it("once Pluggy syncs after midnight, the closed day is covered", () => {
    const item = { status: "UPDATED", lastUpdatedAt: "2026-11-11T09:05:00Z" };
    const carimbo = carimboDeLeitura({ completa: true, item, atual: "2026-11-11T01:40:00Z", agora: new Date("2026-11-11T09:06:00Z") });
    expect(Date.parse(carimbo!)).toBeGreaterThanOrEqual(Date.parse("2026-11-11T03:00:00Z"));
  });

  it("never moves backwards: an older sync date leaves the stored stamp alone", () => {
    const item = { status: "UPDATED", lastUpdatedAt: "2026-11-09T11:57:00Z" };
    expect(carimboDeLeitura({ completa: true, item, atual: "2026-11-10T19:30:00Z", agora })).toBeNull();
  });

  it("an incomplete read of Pluggy never stamps, whatever the item says", () => {
    const item = { status: "UPDATED", lastUpdatedAt: "2026-11-10T19:29:00Z" };
    expect(carimboDeLeitura({ completa: false, item, atual: null, agora })).toBeNull();
  });

  it("PARTIAL_SUCCESS: transactions stayed behind → their own date is the limit", () => {
    const item = {
      status: "UPDATED", lastUpdatedAt: "2026-11-10T19:00:00Z",
      statusDetail: { transactions: { isUpdated: false, lastUpdatedAt: "2026-11-08T22:39:00Z" } },
    };
    expect(coberturaDoItem(item, agora)?.toISOString()).toBe("2026-11-08T22:39:00.000Z");
  });

  it.each(["OUTDATED", "LOGIN_ERROR", "WAITING_USER_INPUT", "UPDATING", "", null])("item %s → no stamp", (status) => {
    expect(coberturaDoItem({ status, lastUpdatedAt: "2026-11-10T19:00:00Z" }, agora)).toBeNull();
  });

  it("Pluggy did not answer, or sent no usable date → no stamp", () => {
    expect(carimboDeLeitura({ completa: true, item: null, atual: null, agora })).toBeNull();
    expect(coberturaDoItem({ status: "UPDATED" }, agora)).toBeNull();
    expect(coberturaDoItem({ status: "UPDATED", lastUpdatedAt: "ontem" }, agora)).toBeNull();
  });

  it("a date ahead of our clock is cut to now", () => {
    const item = { status: "UPDATED", lastUpdatedAt: "2026-11-10T23:00:00Z" };
    expect(coberturaDoItem(item, agora)?.toISOString()).toBe(agora.toISOString());
  });

  it("first read of a new connection (nothing stored) takes Pluggy's date", () => {
    const item = { status: "updated", lastUpdatedAt: "2026-11-10T19:20:00Z" };
    expect(carimboDeLeitura({ completa: true, item, atual: null, agora })).toBe("2026-11-10T19:20:00.000Z");
  });
});
