import { describe, expect, it } from "vitest";
import { ehFolga, faturamentoDoPlano, mapaDeFolga } from "./missao-dias";

const plano = [{ d: "2026-11-01", t: true, u: 39 }, { d: "2026-11-02", t: false, u: 0 }, { d: "2026-11-03", t: true, u: 26 }];

describe("missão molda o calendário (Rick, 01/11)", () => {
  it("faturamento do plano = unidades × preço", () => {
    expect(faturamentoDoPlano(plano, 9.15, 8.71)).toBe(Math.round(65 * 17.86));
  });
  it("folga pela missão vale mais que o perfil; fora do plano vale o perfil", () => {
    const m = mapaDeFolga(plano);
    const perfil = ["friday", "saturday", "sunday"];
    expect(ehFolga("2026-11-02", m, perfil)).toBe(true);   // segunda: folga na missão
    expect(ehFolga("2026-11-03", m, perfil)).toBe(false);  // terça: trabalho na missão (perfil diria folga)
    expect(ehFolga("2026-12-01", m, perfil)).toBe(true);   // fora do plano: terça é folga no perfil
    expect(ehFolga("2026-12-04", null, perfil)).toBe(false);
  });
});

import { mesPelaMissao } from "./missao-dias";
describe("card do mês segue a missão", () => {
  it("meta = faturamento da missão, dias = dias de trabalho do plano dali pra frente", () => {
    const folgas = mapaDeFolga(plano);
    const m = mesPelaMissao({ metaMensal: 8200, vendidoMes: 0, faltaMes: 8200, diasRestantes: 12, precisaDia: 680 }, 20521, folgas, "2026-11-01");
    expect(m).toMatchObject({ metaMensal: 20521, faltaMes: 20521, diasRestantes: 2, precisaDia: 10260 });
  });
});
