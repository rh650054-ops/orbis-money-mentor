import { describe, expect, it } from "vitest";
import { derivar } from "./derivar";
import { blocoExemplo as bloco, periodoExemplo as periodo, relatorioExemplo as rel } from "./exemplo";

describe("derivar — o que cada card mostra", () => {
  const r = derivar(rel(), [], periodo, "semana anterior");

  it("dinheiro: vendeu = caiu + faltou; sobrou = caiu − gastos; de cada R$ 10", () => {
    expect(r.dinheiro.vendeu).toBe(4506);
    expect(r.dinheiro.sobrou).toBe(3141);
    expect(r.dinheiro.pctCaiu).toBe(86);
    expect(r.dinheiro.deCada10).toBeCloseTo(6.97, 2);
    expect(r.dinheiro.delta?.texto).toBe("↓ 37% vs semana anterior");
  });

  it("conferência do banco troca Pix/cartão digitado pelo que o banco viu", () => {
    const comBanco = derivar(rel(), [{ dia: "2026-10-13", lancou: 537, pix_cartao: 500, dinheiro: 37, caiu: 437, maquininha: 0, conta_ranking: 437, faltou: 63 }], periodo, "semana anterior");
    expect(comBanco.dinheiro.caiu).toBe(3892 - 63);
    expect(comBanco.dinheiro.faltou).toBe(614 + 63);
    expect(comBanco.calote.total).toBe(677);
  });

  it("vendas: conversão sobre os totais, ritmo sobre o tempo vendendo", () => {
    expect(r.vendas.conv).toBe(65.4);
    expect(r.vendas.deltaConv?.texto).toBe("↑ 3 p.p. vs semana anterior");
    expect(r.vendas.ritmoMin).toBeCloseTo(940 / 106, 3);
    expect(r.vendas.abordagemCadaMin).toBeCloseTo(940 / 162, 3);
    expect(r.vendas.abordDia).toBe(27);
    expect(r.vendas.ticket).toBeCloseTo(4506 / 106, 2); // ticket sobre o VENDIDO (PR #126)
  });

  it("dias: melhor por R$, mais eficiente por conversão (≥ 5 vendas), e a lista de dias", () => {
    expect(r.dias.melhor?.dia).toBe("2026-10-12");
    expect(r.dias.lista[1]?.vendido).toBe(637); // caiu 537 + faltou 100
    expect(r.dias.maisEficiente?.dia).toBe("2026-10-13"); // 70% > 68%
    expect(r.dias.maisFraco?.dia).toBe("2026-10-16");
  });

  it("horas: agrupa em manhã / almoço / tarde / noite e acha a melhor", () => {
    const alm = r.horas.periodos.find((p) => p.nome === "Almoço")!;
    expect(alm.valor).toBe(765 + 640);
    expect(alm.conv).toBe(69);
    expect(r.horas.melhorPeriodo?.nome).toBe("Almoço");
    expect(r.horas.shareMelhor).toBe(66);
    expect(r.horas.melhorHora?.h).toBe(12);
    expect(r.horas.piorHora?.h).toBe(20);
  });

  it("tempo: ativo / pausas / parado fecham em %, pausas ordenadas por minutos", () => {
    expect(r.tempo.pctAtivo + r.tempo.pctPausa + r.tempo.pctParado).toBeGreaterThanOrEqual(99);
    expect(r.tempo.pausas[0]).toEqual({ motivo: "conversa", n: 6, min: 55 });
    expect(r.tempo.menor?.dia).toBe("2026-10-16");
  });

  it("gastos: linhas com % do total e por dia; outros só aparece se existir", () => {
    expect(r.gastos.linhas.map((l) => l.chave)).toEqual(["mercadoria", "transporte", "alimentacao"]);
    expect(r.gastos.linhas[0]?.pctTotal).toBe(77);
    expect(r.gastos.deCada10).toBeCloseTo(1.67, 2);
    expect(r.gastos.deltaDeCada10?.tom).toBe("down"); // gastou mais por R$ 10 que antes → ruim
  });

  it("calote: total, recuperado, perdido, taxa e comparação com o normal", () => {
    expect(r.calote.total).toBe(614);
    expect(r.calote.recuperado).toBe(150);
    expect(r.calote.perdido).toBe(464);
    expect(r.calote.taxa).toBe(24);
    expect(r.calote.umACada).toBe(27);
    expect(r.calote.vezesNormal).toBeCloseTo(3.4, 1);
  });

  it("insights: no máximo 3 frases, nascidas dos números", () => {
    expect(r.insights.length).toBeLessThanOrEqual(3);
    expect(r.insights.some((i) => i.titulo === "O calote pesou.")).toBe(true);
    expect(r.insights.some((i) => i.titulo.includes("almoço"))).toBe(true);
  });

  it("sem dados: sinaliza pra tela mostrar o estado vazio", () => {
    const vazio = bloco({ dinheiro: { caiu: 0, faltou: 0, vendeu: 0, dinheiro: 0, pix: 0, cartao: 0, gorjetas_dia: 0, mercadoria: 0, transporte: 0, alimentacao: 0, outros: 0, gastos: 0, sobrou: 0 },
      vendas: { abordagens: 0, vendas: 0, valor: 0, conversao: null, abordagens_por_venda: null, ticket: null, metodos: {}, gorjeta: { n: 0, total: 0, maior: 0 } },
      tempo: { worked_min: 0, pausa_min: 0, parado_min: 0, ativo_min: 0, pausas: {}, maior_dia: null, menor_dia: null, melhor_ritmo: null }, dias: [], horas: [] });
    expect(derivar({ atual: vazio, anterior: vazio, normal: vazio }, [], periodo, "x").semDados).toBe(true);
  });
});

describe("calote com Open Finance", () => {
  it("caiu depois vem do banco: total = faltou + o que caiu depois; perdido = faltou", () => {
    const base = derivar(rel(), [], periodo, "7 dias anteriores");
    const r = derivar(rel(), [], periodo, "7 dias anteriores", { total: 131, n: 5 });
    expect(r.calote.peloBanco).toBe(true);
    expect(r.calote.recuperado).toBe(131);
    expect(r.calote.perdido).toBe(base.dinheiro.faltou);
    expect(r.calote.total).toBe(base.dinheiro.faltou + 131);
    expect(base.calote.peloBanco).toBe(false);
  });
});
