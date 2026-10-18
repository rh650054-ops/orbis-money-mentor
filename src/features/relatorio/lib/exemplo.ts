import { blocoSchema, type Bloco, type Periodo, type Relatorio } from "../types";

/* Example period = the mockup v10 week (12/10 → 18/10) approved by Rick on 18/10.
   Used by the unit tests and by the local preview harness; never by the app. */

export function blocoExemplo(over: Partial<Record<keyof Bloco, unknown>> = {}): Bloco {
  return blocoSchema.parse({
    de: "2026-10-12", ate: "2026-10-18", dias_na_rua: 6, dias_com_registro: 6,
    dinheiro: { caiu: 3892, faltou: 614, vendeu: 4506, dinheiro: 452, pix: 3346, cartao: 94, gorjetas_dia: 58,
      mercadoria: 581, transporte: 96, alimentacao: 74, outros: 0, gastos: 751, sobrou: 3141 },
    vendas: { abordagens: 162, vendas: 106, valor: 4506, conversao: 65.4, abordagens_por_venda: 1.53, ticket: 36.72,
      metodos: { pix: { n: 91, valor: 3960 }, dinheiro: { n: 13, valor: 452 }, cartao: { n: 2, valor: 94 } },
      gorjeta: { n: 2, total: 58, maior: 40 } },
    tempo: { worked_min: 1148, pausa_min: 110, parado_min: 98, ativo_min: 940,
      pausas: { conversar: { n: 6, min: 55 }, almoco: { n: 1, min: 40 }, banheiro: { n: 2, min: 15 } },
      maior_dia: { dia: "2026-10-12", min: 300 }, menor_dia: { dia: "2026-10-16", min: 102 }, melhor_ritmo: { dia: "2026-10-12", min: 6.7 } },
    calote: { valor: 614, unidades: 4, recuperado: 150, recuperado_n: 1, perdido: 464, pct_vendeu: 13.6, taxa_recuperacao: 24 },
    dias: [
      { dia: "2026-10-12", abordagens: 44, vendas: 30, caiu: 1262, faltou: 0, worked_min: 300, pausa_min: 40, parado_min: 20 },
      { dia: "2026-10-13", abordagens: 23, vendas: 16, caiu: 537, faltou: 100, worked_min: 165, pausa_min: 20, parado_min: 10 },
      { dia: "2026-10-16", abordagens: 9, vendas: 5, caiu: 132, faltou: 0, worked_min: 102, pausa_min: 0, parado_min: 8 },
    ],
    horas: [
      { h: 9, vendas: 4, valor: 170, abordagens: 6 }, { h: 12, vendas: 18, valor: 765, abordagens: 24 },
      { h: 13, vendas: 15, valor: 640, abordagens: 24 }, { h: 16, vendas: 11, valor: 470, abordagens: 16 }, { h: 20, vendas: 2, valor: 80, abordagens: 2 },
    ],
    ...over,
  });
}

export const periodoExemplo: Periodo = { preset: "semana", de: "2026-10-12", ate: "2026-10-18" };

export function relatorioExemplo(): Relatorio {
  const anterior = blocoExemplo({ dinheiro: { caiu: 7000, faltou: 200, vendeu: 7200, dinheiro: 700, pix: 6200, cartao: 100, gorjetas_dia: 0, mercadoria: 1000, transporte: 50, alimentacao: 44, outros: 0, gastos: 1094, sobrou: 5906 },
    vendas: { abordagens: 300, vendas: 190, valor: 7200, conversao: 62.3, abordagens_por_venda: 1.58, ticket: 36.8, metodos: {}, gorjeta: { n: 0, total: 0, maior: 0 } },
    tempo: { worked_min: 2100, pausa_min: 200, parado_min: 150, ativo_min: 1750, pausas: {}, maior_dia: null, menor_dia: null, melhor_ritmo: null } });
  const normal = blocoExemplo({ dinheiro: { caiu: 9608, faltou: 400, vendeu: 10008, dinheiro: 798, pix: 8790, cartao: 19, gorjetas_dia: 121, mercadoria: 1766, transporte: 7, alimentacao: 114, outros: 200, gastos: 2088, sobrou: 7519 },
    vendas: { abordagens: 628, vendas: 399, valor: 9694, conversao: 63.5, abordagens_por_venda: 1.57, ticket: 24.08, metodos: {}, gorjeta: { n: 3, total: 121, maior: 60 } } });
  return { atual: blocoExemplo(), anterior, normal };
}
