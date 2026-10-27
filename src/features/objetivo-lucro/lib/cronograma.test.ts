import { describe, expect, it } from "vitest";
import { cronograma } from "./cronograma";
import type { BaseLucro } from "../types";

const rick: BaseLucro = {
  apelido: "Rick", janela_dias: 60, dias_vendidos: 38, unidades: 807, vendas: 18493.5, unid_dia: 21.2, recorde_dia: 76,
  recorde_data: "2026-09-26", ticket: 22.92, custo_unid: 7.76, custo_receita: 5.68, calote_unid: 2.08, custo_extrato: 8.98,
  gastos_corre: 7246.78, entradas_corre: 15911, gastos_pessoais: 13784, categorias: [], fonte_custo: "receita", banco: true,
  estoque: 125, produto_nome: "Batida", frequencia: 0.633,
  semana: [{ dow: 0, unid_dia: 20.8, dias: 6 }, { dow: 1, unid_dia: 6.5, dias: 2 }, { dow: 2, unid_dia: 5.8, dias: 5 }, { dow: 3, unid_dia: 30, dias: 4 },
    { dow: 4, unid_dia: 13.2, dias: 5 }, { dow: 5, unid_dia: 23.4, dias: 7 }, { dow: 6, unid_dia: 32.2, dias: 9 }],
  quinzenas: { ultimos15: 196, anteriores15: 176 },
  calote: { valor: 788, unidades: 0, dias: 6, recuperado: 250, perdido: 538, pct: 4.1, estimado_banco: 1677.47, app_pix: 17588.5, usado: 1677.47, fonte: "banco", por_dia: 44.14, pct_pix: 9.5 },
  transporte: 325, alimentacao: 68,
  combos: { um: 67, dois: 29, tres: 4, preco_um: 18.43, preco_dois: 33.94, unid_por_venda: 1.41, ticket_venda: 25.06 }, vendas_dia: 19.4, preco_tabela: 20,
};

describe("cronograma", () => {
  // Tuesday 27/10/2026 → 15 days, 9 of work.
  const c = cronograma(rick, 5000, 15, 9, new Date("2026-10-27T12:00:00"));

  it("works the strongest weekdays and adds up to the target", () => {
    expect(c.dias).toHaveLength(15);
    expect(c.dias.filter((d) => d.trabalha)).toHaveLength(9);
    const soma = c.dias.reduce((s, d) => s + d.unid, 0);
    expect(soma).toBe(c.totalUnid);
    expect(c.totalUnid).toBe(Math.ceil(5000 / (22.92 - 7.76)));
    // Mondays and Tuesdays (6/dia) are off; every Saturday/Wednesday is on.
    for (const d of c.dias) {
      if (d.dow === 6 || d.dow === 3) expect(d.trabalha).toBe(true);
      if (d.dow === 1 || d.dow === 2) expect(d.trabalha).toBe(false);
    }
  });

  it("is balanced: strong days carry more, but no day carries it all", () => {
    expect(c.maiorDia).toBeGreaterThan(c.menorDia);
    expect(c.maiorDia).toBeLessThan(c.totalUnid / 2);
  });

  it("tracks stock and sales per day", () => {
    const trab = c.dias.filter((d) => d.trabalha);
    expect(trab[0]!.atendimentos).toBe(Math.ceil(trab[0]!.unid / 1.41));
    expect(c.produzirAte).not.toBeNull();
    expect(c.dias[c.dias.length - 1]!.estoqueFim).toBe(125 - c.totalUnid);
    for (const d of trab) expect(d.unid).toBeLessThanOrEqual(76 + c.totalUnid); // last day takes the remainder
  });

  it("moves units away from a rainy day and prefers dry days off", () => {
    const seco = cronograma(rick, 5000, 15, 15, new Date("2026-10-27T12:00:00"));
    const previsao = new Map([["2026-10-31", { tipo: "chuva" as const, prob: 92, codigo: 95, max: 24 }]]);
    const comChuva = cronograma(rick, 5000, 15, 15, new Date("2026-10-27T12:00:00"), { previsao, fator: 0.66 });
    const sab = (x: typeof seco) => x.dias.find((d) => d.data === "2026-10-31")!.unid;
    expect(sab(comChuva)).toBeLessThan(sab(seco));
    expect(comChuva.totalUnid).toBe(seco.totalUnid);
    expect(comChuva.diasChuva).toEqual(["2026-10-31"]);
    const folga = cronograma(rick, 5000, 15, 9, new Date("2026-10-27T12:00:00"), { previsao, fator: 0.2 });
    expect(folga.chuvaEvitada).toEqual(["2026-10-31"]);
  });

  it("the cumulative curve ends at the target and the average pace ends below it", () => {
    const fim = c.dias[c.dias.length - 1]!;
    expect(Math.round(fim.acumulado)).toBeGreaterThanOrEqual(5000);
    expect(fim.acumuladoMedia).toBeLessThan(fim.acumulado);
    expect(Math.round(c.mercadoriaTotal)).toBe(Math.round(c.totalUnid * 5.68));
  });
});
