import { describe, expect, it } from "vitest";
import { faixaAtingida, lerMetaDoDia, listarDias, metaPorBloco } from "./meta-viavel";

// linha real de metas_dia do Rick em 11/10/2026 (saída de vant_meta_calcular)
const LINHA = {
  dia: "2026-10-11", meta: 900, ritmo: 690, turbo: 1080, minimo: 720, status: "inviavel", ticket: 20,
  falta_mes: 23659.97, mes_viavel: 13300, amostra_dia: 5, meta_mensal: 27000, precisa_dia: 1970, vendido_mes: 3340.03, dias_restantes: 12,
  curva: [107.66, 90.51, 59.68, 51.17, 33.76, 29.05, 15.1, 15.68, 6.47, 0],
  plano_maximo: { pct: 79, chega: false, blocos: 10, meta_dia: 1000, projecao: 21300, dias_extra: ["wednesday", "monday"], vendas_dia: 50, vendas_hora: 5, dias_restantes: 18, vendas_dia_realista: 42 },
};

describe("meta viável (leitura e ajudantes de tela)", () => {
  it("lê a linha do servidor", () => {
    const m = lerMetaDoDia(LINHA);
    expect(m?.diaSemana).toBe(0);
    expect(m?.meta).toBe(900);
    expect(m?.status).toBe("inviavel");
    expect(m?.maximo?.diasExtra).toEqual(["wednesday", "monday"]);
    expect(m?.maximo?.vendasDia).toBe(50);
    expect(m?.curva).toHaveLength(10);
    expect(lerMetaDoDia(null)).toBeNull();
    expect(lerMetaDoDia({})).toBeNull();
  });

  it("status desconhecido vira 'aprendendo' e plano ausente vira null", () => {
    const m = lerMetaDoDia({ ...LINHA, status: "xpto", plano_maximo: null });
    expect(m?.status).toBe("aprendendo");
    expect(m?.maximo).toBeNull();
  });

  it("faixas", () => {
    const m = { minimo: 720, meta: 900, turbo: 1080 };
    expect(faixaAtingida(700, m)).toBe("nenhuma");
    expect(faixaAtingida(800, m)).toBe("minimo");
    expect(faixaAtingida(1053, m)).toBe("meta");
    expect(faixaAtingida(1200, m)).toBe("turbo");
  });

  it("divide a meta pela curva de hora dele, com piso pra hora fraca", () => {
    expect(metaPorBloco(800, 4, [])).toEqual([200, 200, 200, 200]);
    const curva = metaPorBloco(900, 8, LINHA.curva);
    expect(curva.reduce((a, b) => a + b, 0)).toBeCloseTo(900, 1);
    expect(curva[0]).toBeGreaterThan(curva[4] ?? 0);
    expect(curva[7]).toBeGreaterThan(0);
  });

  it("lista dias em português", () => {
    expect(listarDias(["wednesday"])).toBe("quarta");
    expect(listarDias(["wednesday", "monday"])).toBe("quarta e segunda");
    expect(listarDias(["wednesday", "monday", "tuesday"])).toBe("quarta, segunda e terça");
  });
});
