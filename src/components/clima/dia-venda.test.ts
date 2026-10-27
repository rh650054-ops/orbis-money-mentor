import { describe, expect, it } from "vitest";
import { diaDeVenda } from "./dia-venda";
import type { DiaClima } from "@/hooks/useClima";

const dia = (horas: Array<[number, number, number, number]>, extra: Partial<DiaClima> = {}): DiaClima => ({
  data: "2026-10-27", codigo: 51, max: 22, min: 12, prob: 6, mm: 0.2, conf: "alta",
  horas: horas.map(([hora, codigo, chance, mm]) => ({ hora, codigo, temp: 20, chance, mm })), ...extra,
});

describe("diaDeVenda", () => {
  it("sunny day with a drizzle code at 8h is not a drizzle day", () => {
    const d = diaDeVenda(dia([[6, 45, 0, 0], [8, 51, 6, 0.1], [9, 51, 6, 0.1], [10, 3, 4, 0], [11, 2, 2, 0], [12, 0, 0, 0], [13, 1, 0, 0], [14, 1, 0, 0], [15, 3, 0, 0], [16, 1, 0, 0], [17, 2, 0, 0]]));
    expect(d.codigo).toBeLessThanOrEqual(3);
    expect(d.prob).toBeLessThanOrEqual(20);
    expect(d.garoa).toBe(false);
  });

  it("light drizzle all afternoon is 'garoa', not a rain day", () => {
    const d = diaDeVenda(dia([[10, 3, 20, 0], [12, 3, 47, 0], [13, 51, 63, 0.2], [14, 51, 78, 0.2], [15, 51, 86, 0.2], [16, 51, 81, 0.1], [17, 51, 68, 0.1], [18, 51, 53, 0.1]], { prob: 86 }));
    expect(d.codigo).toBe(51);
    expect(d.garoa).toBe(true);
  });

  it("a real rain day stays a rain day", () => {
    const d = diaDeVenda(dia([[8, 53, 90, 0.7], [10, 53, 94, 0.5], [12, 80, 98, 1.9], [13, 80, 99, 1.8], [14, 80, 100, 2.0], [15, 80, 100, 2.2], [17, 81, 100, 2.6]], { prob: 100 }));
    expect(d.codigo).toBeGreaterThanOrEqual(80);
    expect(d.prob).toBeGreaterThanOrEqual(98);
    expect(d.garoa).toBe(false);
  });
});
