import { describe, expect, it } from "vitest";
import { addDias, brl, diasEntre, fmtMin, fmtMinSeg, periodoDoPreset, rotuloAnterior, rotuloPeriodo } from "./periodo";

describe("períodos do relatório", () => {
  const hoje = "2026-10-18"; // domingo

  it("hoje e ontem são um dia só", () => {
    expect(periodoDoPreset("hoje", hoje)).toEqual({ preset: "hoje", de: hoje, ate: hoje });
    expect(periodoDoPreset("ontem", hoje)).toEqual({ preset: "ontem", de: "2026-10-17", ate: "2026-10-17" });
  });

  it("semana são os últimos 7 dias, terminando hoje (na segunda não fica só com o dia de hoje)", () => {
    expect(periodoDoPreset("semana", hoje)).toEqual({ preset: "semana", de: addDias(hoje, -6), ate: hoje });
    expect(periodoDoPreset("semana", "2026-10-19")).toEqual({ preset: "semana", de: "2026-10-13", ate: "2026-10-19" }); // segunda
  });

  it("mês começa no dia 1; 7d e 30d são janelas correntes", () => {
    expect(periodoDoPreset("mes", hoje).de).toBe("2026-10-01");
    expect(periodoDoPreset("7d", hoje)).toMatchObject({ de: "2026-10-12", ate: hoje });
    expect(periodoDoPreset("30d", hoje)).toMatchObject({ de: "2026-09-19", ate: hoje });
  });

  it("personalizado invertido é corrigido e nunca passa de hoje por padrão", () => {
    expect(periodoDoPreset("custom", hoje, { de: "2026-10-10", ate: "2026-10-03" })).toMatchObject({ de: "2026-10-03", ate: "2026-10-10" });
    expect(periodoDoPreset("custom", hoje)).toMatchObject({ de: "2026-10-12", ate: hoje });
  });

  it("aritmética de dias sem fuso", () => {
    expect(addDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(diasEntre("2026-10-12", "2026-10-18")).toBe(7);
  });

  it("rótulos em português de rua", () => {
    expect(rotuloPeriodo({ preset: "semana", de: "2026-10-12", ate: "2026-10-18" })).toBe("12/10 → 18/10");
    expect(rotuloPeriodo({ preset: "ontem", de: "2026-10-17", ate: "2026-10-17" })).toBe("sábado 17/10");
    expect(rotuloAnterior({ preset: "hoje", de: hoje, ate: hoje })).toBe("ontem");
    expect(rotuloAnterior({ preset: "mes", de: "2026-10-01", ate: hoje })).toBe("mês anterior");
  });

  it("formata tempo e dinheiro do jeito que aparece na tela", () => {
    expect(fmtMin(191)).toBe("3h11");
    expect(fmtMin(45)).toBe("45min");
    expect(fmtMin(0)).toBe("0min");
    expect(fmtMinSeg(8.87)).toBe("8min52s");
    expect(fmtMinSeg(6)).toBe("6min");
    expect(fmtMinSeg(0)).toBe("—");
    expect(brl(3892)).toBe("R$ 3.892");
    expect(brl(24.07)).toBe("R$ 24");
    expect(brl(24.07, true)).toBe("R$ 24,07");
    expect(brl(3892, true)).toBe("R$ 3.892,00");
  });
});
