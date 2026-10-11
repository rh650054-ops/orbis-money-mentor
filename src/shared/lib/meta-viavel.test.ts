import { describe, expect, it } from "vitest";
import { diasDeTrabalhoRestantes, faixaAtingida, mediana, metaDoDia, metaPorBloco, ritmoDoDia, type DiaHistorico } from "./meta-viavel";

// histórico real do Rick (ago–out/2026), vendido por dia
const RICK: DiaHistorico[] = [
  ["2026-08-16", 650], ["2026-08-19", 535], ["2026-08-22", 625], ["2026-08-23", 426], ["2026-08-27", 820.01],
  ["2026-08-29", 1025], ["2026-08-30", 740], ["2026-09-02", 455], ["2026-09-03", 1103], ["2026-09-04", 348],
  ["2026-09-05", 120], ["2026-09-11", 500], ["2026-09-12", 225], ["2026-09-19", 180], ["2026-09-20", 764],
  ["2026-09-23", 700], ["2026-09-25", 1680], ["2026-09-26", 2003.5], ["2026-09-29", 12], ["2026-10-01", 150],
  ["2026-10-02", 30], ["2026-10-03", 661], ["2026-10-04", 880], ["2026-10-06", 0], ["2026-10-09", 566.03], ["2026-10-10", 1053],
].map(([date, vendido]) => ({ date: String(date), vendido: Number(vendido) }));
const PERFIL = { metaMensal: 27000, diasTrabalho: ["thursday", "friday", "saturday", "sunday"], metaBase: 1125 };

describe("meta viável", () => {
  it("mediana", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 2, 3])).toBe(2.5);
    expect(mediana([])).toBe(0);
  });

  it("conta os dias de trabalho que faltam no mês", () => {
    // 11/10 é domingo; qui–dom até 31/10 = 11, 15-18, 22-25, 29-31
    expect(diasDeTrabalhoRestantes("2026-10-11", PERFIL.diasTrabalho)).toBe(12);
    expect(diasDeTrabalhoRestantes("2026-10-11", PERFIL.diasTrabalho, false)).toBe(11);
    expect(diasDeTrabalhoRestantes("2026-10-31", ["saturday"])).toBe(1);
  });

  it("ritmo do domingo do Rick mistura os domingos com a mediana geral", () => {
    const r = ritmoDoDia(RICK, "2026-10-11", 1125);
    // domingos (8 semanas): 16/08 650, 23/08 426, 30/08 740, 20/09 764, 04/10 880 → mediana 740
    // geral (14 últimos trabalhados): mediana 613,5 → 0,6·740 + 0,4·613,5 ≈ 689 → 690
    expect(r.aprendendo).toBe(false);
    expect(r.amostraDia).toBe(5);
    expect(r.ritmo).toBe(690);
  });

  it("conta nova cai no fallback e fica 'aprendendo'", () => {
    const r = ritmoDoDia([{ date: "2026-10-09", vendido: 300 }], "2026-10-11", 200);
    expect(r).toEqual({ ritmo: 200, amostraDia: 0, aprendendo: true });
  });

  it("Rick hoje: 27 mil é inviável no ritmo, meta trava em 1,3× e o app sugere replanejar", () => {
    const m = metaDoDia({ hoje: "2026-10-11", historico: RICK, perfil: PERFIL, vendidoMes: 3340.03 });
    expect(m.diasRestantes).toBe(12);
    expect(m.precisaDia).toBe(1970); // 23.660 ÷ 12
    expect(m.status).toBe("inviavel");
    expect(m.meta).toBe(900); // 1,3 × 690
    expect(m.minimo).toBe(720);
    expect(m.turbo).toBe(1080);
    expect(m.mesViavel).toBe(13300); // 3.340 + 828 × 12
    expect(m.maisUmDia).toBe(3); // quarta
    expect(m.precisaComMaisUmDia).toBe(1580); // 23.660 ÷ 15
  });

  it("mês folgado: a meta é o ritmo dele, não cai abaixo", () => {
    const m = metaDoDia({ hoje: "2026-10-11", historico: RICK, perfil: { ...PERFIL, metaMensal: 6000 }, vendidoMes: 3340 });
    expect(m.status).toBe("folga");
    expect(m.meta).toBe(690);
  });

  it("apertado: precisa até 1,3× vira a meta do dia", () => {
    const m = metaDoDia({ hoje: "2026-10-11", historico: RICK, perfil: { ...PERFIL, metaMensal: 14000 }, vendidoMes: 3340 });
    expect(m.precisaDia).toBe(890);
    expect(m.status).toBe("apertado");
    expect(m.meta).toBe(890);
  });

  it("o vendido de hoje não some do 'falta' antes do dia acabar", () => {
    const a = metaDoDia({ hoje: "2026-10-11", historico: RICK, perfil: PERFIL, vendidoMes: 3340.03 });
    const b = metaDoDia({ hoje: "2026-10-11", historico: RICK, perfil: PERFIL, vendidoMes: 3740.03, vendidoHoje: 400 });
    expect(b.meta).toBe(a.meta);
  });

  it("faixas", () => {
    const m = { minimo: 750, meta: 940, turbo: 1130 };
    expect(faixaAtingida(700, m)).toBe("nenhuma");
    expect(faixaAtingida(800, m)).toBe("minimo");
    expect(faixaAtingida(1053, m)).toBe("meta");
    expect(faixaAtingida(1200, m)).toBe("turbo");
  });

  it("divide a meta pela curva de hora dele, com piso pra hora fraca", () => {
    const flat = metaPorBloco(800, 4, []);
    expect(flat).toEqual([200, 200, 200, 200]);
    const curva = metaPorBloco(800, 4, [104.83, 88.13, 58.11, 0]);
    expect(curva.reduce((a, b) => a + b, 0)).toBeCloseTo(800, 1);
    expect(curva[0]).toBeGreaterThan(curva[2] ?? 0);
    expect(curva[3]).toBeGreaterThan(0);
  });
});
