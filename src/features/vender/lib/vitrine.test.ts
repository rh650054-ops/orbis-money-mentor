import { describe, expect, it } from "vitest";
import type { DiaConc } from "../types";
import { assinaEssencial, diasRestantesDeTeste, lancadoUltimos3Dias } from "./vitrine";

const dia = (d: string, fez: number): DiaConc => ({ dia: d, fez, dinheiro: 0, caiu: null, depois: 0, pessoal: 0, qtd: 1, conferido: false });

describe("vitrine do Pro", () => {
  it("sums only what was typed today and the 2 days before", () => {
    const dias = [dia("2026-10-21", 500), dia("2026-10-23", 300), dia("2026-10-24", 212), dia("2026-10-25", 400)];
    expect(lancadoUltimos3Dias(dias, "2026-10-25")).toBe(912);
    expect(lancadoUltimos3Dias([], "2026-10-25")).toBe(0);
  });

  it("counts trial days left, across a month boundary, never negative", () => {
    expect(diasRestantesDeTeste("trial", "2026-10-28", "2026-10-25")).toBe(3);
    expect(diasRestantesDeTeste("trial", "2026-11-01", "2026-10-31")).toBe(1);
    expect(diasRestantesDeTeste("trial", "2026-10-25", "2026-10-25")).toBe(0);
    expect(diasRestantesDeTeste("trial", "2026-10-20", "2026-10-25")).toBe(0);
    expect(diasRestantesDeTeste("active", "2026-10-28", "2026-10-25")).toBeNull();
  });

  it("only a paying subscriber sees the upgrade-only version", () => {
    expect(assinaEssencial({ subscribed: true, status: "active" })).toBe(true);
    expect(assinaEssencial({ subscribed: true, status: "trial" })).toBe(false);
    expect(assinaEssencial({ subscribed: true, status: "demo" })).toBe(false);
    expect(assinaEssencial({ subscribed: false, status: "inactive" })).toBe(false);
  });
});
