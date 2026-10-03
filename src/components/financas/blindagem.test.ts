import { describe, expect, it } from "vitest";
import { diasUteisAteBlindar, guardadoMedioDia, recadoBlindado, seloConta } from "./blindagem";

describe("guardadoMedioDia", () => {
  it("averages what was saved over the work days of the last 2 weeks", () => {
    const hoje = new Date("2026-10-15T12:00:00"); // quinta
    const dias = { "2026-10-14": 40, "2026-10-13": 20, "2026-09-30": 999 };
    // seg a sáb = 12 dias úteis nos 14 dias anteriores
    const uteis = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    expect(guardadoMedioDia(dias, uteis, hoje)).toBe(5);
  });
  it("is zero without history", () => {
    expect(guardadoMedioDia({}, null, new Date("2026-10-15T12:00:00"))).toBe(0);
  });
});

describe("diasUteisAteBlindar", () => {
  it("rounds up the work days needed", () => {
    expect(diasUteisAteBlindar(590, 82)).toBe(8);
    expect(diasUteisAteBlindar(0, 82)).toBe(0);
    expect(diasUteisAteBlindar(590, 0)).toBeNull();
  });
});

describe("recadoBlindado", () => {
  const base = { falta: 590, ritmoContas: 82, lucroDia: 300, proxima: { nome: "Aluguel", dia: "dia 10" }, diaBlindado: "dia 19" };
  it("says how much more a day closes the gap", () => {
    const r = recadoBlindado({ ...base, guardaDia: 54 });
    expect(r?.titulo).toBe("Você guarda 18% do lucro. Suas contas pedem 27%.");
    expect(r?.texto).toContain("Aluguel chega paga no dia 10");
    expect(r?.tom).toBe("ouro");
  });
  it("praises when the pace is enough", () => {
    const r = recadoBlindado({ ...base, guardaDia: 90 });
    expect(r?.tom).toBe("ok");
    expect(r?.texto).toBe("Nesse ritmo o mês fecha blindado no dia 19.");
  });
  it("celebrates a covered month and stays quiet without bills", () => {
    expect(recadoBlindado({ ...base, falta: 0, guardaDia: 0 })?.titulo).toBe("Mês blindado.");
    expect(recadoBlindado({ ...base, falta: 0, ritmoContas: 0, guardaDia: 0 })).toBeNull();
  });
});

describe("seloConta", () => {
  it("picks one badge per bill", () => {
    expect(seloConta({ paga: false, vencida: true, coberta: false, diasAteVencer: -1 })?.texto).toBe("VENCEU ONTEM");
    expect(seloConta({ paga: false, vencida: true, coberta: false, diasAteVencer: -4 })?.texto).toBe("VENCEU HÁ 4 DIAS");
    expect(seloConta({ paga: false, vencida: false, coberta: true, diasAteVencer: 5 })?.texto).toBe("BLINDADA");
    expect(seloConta({ paga: false, vencida: false, coberta: false, diasAteVencer: 0 })?.texto).toBe("VENCE HOJE");
    expect(seloConta({ paga: true, vencida: false, coberta: true, diasAteVencer: 20 })?.texto).toBe("PAGA");
    expect(seloConta({ paga: false, vencida: false, coberta: false, diasAteVencer: 9 })).toBeNull();
  });
});
