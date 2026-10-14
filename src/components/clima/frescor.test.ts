import { describe, expect, it } from "vitest";
import type { Tempo } from "@/hooks/useClima";
import { horaAgoraBR, nomeDiaPelaData, quandoFoi, tempoDeAgora } from "./frescor";

const dia = (data: string) => ({ data, codigo: 61, max: 26, min: 17, prob: 80, mm: 3, conf: "media" as const, horas: [] });
const hora = (iso: string) => ({ hora: Number(iso.slice(11, 13)), iso, fontes: 3, total: 6, mm: 0.5, temp: 20, prob: 60, codigo: 61 });

// leitura de segunda 12/10, aberta na quarta 14/10 às 10h
const antiga = {
  dias: ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"].map(dia),
  horas: ["2026-10-12T21:00", "2026-10-12T22:00"].map(hora),
} as unknown as Tempo;

describe("previsão guardada", () => {
  it("leitura de segunda aberta na quarta: some o passado e o primeiro dia vira Hoje", () => {
    const { tempo, velha } = tempoDeAgora(antiga, "2026-10-14T10");
    expect(velha).toBe(true);
    expect(tempo.dias!.map((d) => d.data)).toEqual(["2026-10-14", "2026-10-15", "2026-10-16"]);
    expect(nomeDiaPelaData(tempo.dias![0]!.data, "2026-10-14")).toBe("Hoje");
    expect(nomeDiaPelaData(tempo.dias![1]!.data, "2026-10-14")).toBe("Amanhã");
    expect(nomeDiaPelaData(tempo.dias![2]!.data, "2026-10-14")).toBe("Sex");
  });

  it("leitura de agora não é velha e mantém as horas que vêm", () => {
    const fresco = { ...antiga, dias: [dia("2026-10-14"), dia("2026-10-15")], horas: ["2026-10-14T09:00", "2026-10-14T10:00", "2026-10-14T11:00"].map(hora) } as unknown as Tempo;
    const { tempo, velha } = tempoDeAgora(fresco, "2026-10-14T10");
    expect(velha).toBe(false);
    expect(tempo.horas.map((h) => h.hora)).toEqual([10, 11]);
  });

  it("hora de Brasília, não do aparelho", () => {
    expect(horaAgoraBR(new Date("2026-10-14T13:20:00Z"))).toBe("2026-10-14T10");
    expect(horaAgoraBR(new Date("2026-10-15T02:30:00Z"))).toBe("2026-10-14T23");
  });

  it("diz quando foi a leitura", () => {
    const agora = new Date("2026-10-14T13:20:00Z");
    expect(quandoFoi("2026-10-14T12:40:00Z", agora)).toBe("hoje às 09h40");
    expect(quandoFoi("2026-10-13T23:00:00Z", agora)).toBe("ontem às 20h00");
    expect(quandoFoi("2026-10-12T21:00:00Z", agora)).toMatch(/12\/10 às 18h00$/);
  });
});
