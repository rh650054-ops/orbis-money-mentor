import { describe, expect, it } from "vitest";
import { codigoDaAssinatura, fimDoPeriodo } from "./periodo";

const agora = new Date("2026-11-04T12:00:00Z");

describe("fixed due day (Rick, 04/11)", () => {
  it("uses Hotmart's next charge date", () => {
    const prox = Date.parse("2026-12-02T03:00:00Z");
    expect(fimDoPeriodo(prox, 30, agora).toISOString()).toBe("2026-12-02T03:00:00.000Z");
  });
  it("COMPLETE a week later gives the same end (no 8 free days)", () => {
    const prox = Date.parse("2026-12-02T03:00:00Z");
    const umaSemanaDepois = new Date("2026-11-11T12:00:00Z");
    expect(fimDoPeriodo(prox, 30, umaSemanaDepois).getTime()).toBe(fimDoPeriodo(prox, 30, agora).getTime());
  });
  it("missing, past or absurd date → now + plan days", () => {
    expect(fimDoPeriodo(undefined, 30, agora).toISOString()).toBe("2026-12-04T12:00:00.000Z");
    expect(fimDoPeriodo(Date.parse("2026-10-01T00:00:00Z"), 30, agora).toISOString()).toBe("2026-12-04T12:00:00.000Z");
    expect(fimDoPeriodo(Date.parse("2030-01-01T00:00:00Z"), 365, agora).getUTCFullYear()).toBe(2027);
  });
});

describe("subscription code of the event", () => {
  it("purchase events", () => expect(codigoDaAssinatura({ data: { subscription: { subscriber: { code: "A1" } } } })).toBe("A1"));
  it("cancellations (data.subscriber.code)", () => expect(codigoDaAssinatura({ data: { subscriber: { code: "B2" } } })).toBe("B2"));
  it("none", () => expect(codigoDaAssinatura({ data: {} })).toBe(""));
});
