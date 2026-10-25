import { describe, expect, it } from "vitest";
import { lerMetaDoDia, mostraFaixas, ofereceAdaptativa, vendasPara, type MetaDoDia } from "./meta-viavel";

// 25/10/2026: meta padrão (a do planejamento) × adaptativa (3 faixas pelo ritmo)
const BASE = {
  dia: "2026-10-25", meta: 1200, ritmo: 250, turbo: 400, minimo: 260, status: "inviavel", ticket: 10,
  falta_mes: 6000, mes_viavel: 4000, amostra_dia: 3, meta_mensal: 9000, precisa_dia: 1200, vendido_mes: 3000,
  dias_restantes: 5, curva: [], plano_maximo: null,
};

describe("modo da meta do dia", () => {
  it("linha antiga (sem modo) vira padrão e meta adaptativa = meta", () => {
    const m = lerMetaDoDia(BASE) as MetaDoDia;
    expect(m.modo).toBe("padrao");
    expect(m.metaAdaptativa).toBe(1200);
    expect(m.diasVendidos).toBe(0);
  });

  it("padrão: um número só, sem faixas, mesmo com ritmo conhecido", () => {
    const m = lerMetaDoDia({ ...BASE, modo: "padrao", meta_adaptativa: 330, dias_vendidos: 12 }) as MetaDoDia;
    expect(m.meta).toBe(1200);
    expect(m.metaAdaptativa).toBe(330);
    expect(mostraFaixas(m)).toBe(false);
    expect(ofereceAdaptativa(m)).toBe(true);
  });

  it("adaptativo: faixas aparecem; conta 'aprendendo' não", () => {
    const m = lerMetaDoDia({ ...BASE, modo: "adaptativo", meta: 330, meta_adaptativa: 330, dias_vendidos: 12 }) as MetaDoDia;
    expect(mostraFaixas(m)).toBe(true);
    expect(mostraFaixas({ ...m, status: "aprendendo" })).toBe(false);
  });

  it("conta nova (menos de 3 dias vendidos) não vê a oferta", () => {
    const m = lerMetaDoDia({ ...BASE, modo: "padrao", dias_vendidos: 2 }) as MetaDoDia;
    expect(ofereceAdaptativa(m)).toBe(false);
    expect(ofereceAdaptativa(null)).toBe(false);
  });

  it("vendas por hora pelo ticket", () => {
    expect(vendasPara(171, 20)).toBe(9);
    expect(vendasPara(5, 20)).toBe(1);
    expect(vendasPara(171, null)).toBeNull();
    expect(vendasPara(0, 20)).toBeNull();
  });
});
