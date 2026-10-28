import { describe, expect, it } from "vitest";
import { derivar, diaComBanco } from "./derivar";
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
    expect(comBanco.calote.total).toBe(677 + 150); // faltou + o que caiu depois (manual)
    expect(comBanco.dias.lista[1]).toMatchObject({ caiu: 474, faltou: 163, vendido: 637 }); // gráfico = card
  });

  it("banco nunca vira venda que não houve (27/10)", () => {
    // passado: vale o que conta no ranking; hoje: no máximo o vendido menos o dinheiro
    const passado = derivar(rel(), [{ dia: "2026-10-13", lancou: 537, pix_cartao: 500, dinheiro: 37, caiu: 5900, maquininha: 0, conta_ranking: 600, faltou: 0 }], periodo, "x");
    expect(passado.dinheiro.caiu).toBe(3892 - 537 + 637); // 37 + 600 > 637 vendido → vira o novo vendido, não 5.937
    expect(diaComBanco({ dia: "2099-01-01", lancou: 100, pix_cartao: 80, dinheiro: 20, caiu: 900, maquininha: 0, conta_ranking: 100, faltou: 0 }, 100, "2099-01-01"))
      .toEqual({ caiu: 100, faltou: 0 });
    expect(diaComBanco({ dia: "2099-01-01", lancou: 100, pix_cartao: 80, dinheiro: 20, caiu: 50, maquininha: 0, conta_ranking: 100, faltou: 30 }, 100, "2099-01-01"))
      .toEqual({ caiu: 70, faltou: 30 });
    // passado com a folga de R$ 500 do ranking: no relatório não passa do vendido
    expect(diaComBanco({ dia: "2026-10-01", lancou: 500, pix_cartao: 400, dinheiro: 100, caiu: 750, maquininha: 0, conta_ranking: 750, faltou: 0 }, 500, "2026-10-27"))
      .toEqual({ caiu: 500, faltou: 0 });
    // dia que o vendedor confirmou como venda (ranking sem teto): entra inteiro
    expect(diaComBanco({ dia: "2026-10-16", lancou: 2400, pix_cartao: 1032, dinheiro: 1368, caiu: 6455, maquininha: 0, conta_ranking: 6455, faltou: 0 }, 2400, "2026-10-27"))
      .toEqual({ caiu: 7823, faltou: 0 });
  });

  it("vendas depois da meia-noite são da noite, não de 'cedo' (27/10)", () => {
    const b = bloco({ horas: [{ h: 1, vendas: 3, valor: 90, abordagens: 5 }, { h: 20, vendas: 2, valor: 60, abordagens: 4 }] });
    const x = derivar({ ...rel(), atual: b }, [], periodo, "x");
    expect(x.horas.periodos.some((p) => p.nome === "Cedo")).toBe(false);
    expect(x.horas.periodos.find((p) => p.nome === "Noite")).toMatchObject({ valor: 150, faixa: "18–4h" });
    expect(x.horas.barras[0]?.h).toBe(8);
    expect(x.horas.barras.at(-1)?.h).toBe(1);
  });

  it("vendas: conversão sobre os totais, ritmo sobre o tempo vendendo", () => {
    expect(r.vendas.conv).toBe(65.4);
    expect(r.vendas.deltaConv?.texto).toBe("↑ 3 p.p. vs semana anterior");
    expect(r.vendas.ritmoMin).toBeCloseTo(940 / 106, 3);
    expect(r.vendas.abordagemCadaMin).toBeCloseTo(940 / 162, 3);
    expect(r.vendas.abordDia).toBe(27);
    expect(r.vendas.ticket).toBe(42.51); // valor das vendas do Foco (4506) ÷ nº dessas vendas (106), 27/10
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
    // total_debt já é o que AINDA falta: total = faltou + recuperado, perdido = faltou (27/10)
    expect(r.calote.total).toBe(764);
    expect(r.calote.recuperado).toBe(150);
    expect(r.calote.perdido).toBe(614);
    expect(r.calote.taxa).toBe(20);
    expect(r.calote.umACada).toBe(27); // 4 unidades marcadas
    expect(r.calote.vezesNormal).toBeCloseTo(3.4, 1); // perdido × perdido normal
  });

  it("calote sem unidades marcadas não inventa '1 a cada X' (27/10)", () => {
    const b = bloco({ calote: { valor: 614, unidades: 0, recuperado: 0, recuperado_n: 0, perdido: 614, pct_vendeu: 13.6, taxa_recuperacao: 0 } });
    expect(derivar({ ...rel(), atual: b }, [], periodo, "x").calote.umACada).toBeNull();
  });

  it("conversão de dia sem abordagem marcada não aparece; vendas antes das 8h entram (27/10)", () => {
    const b = bloco({
      dias: [{ dia: "2026-10-12", abordagens: 30, vendas: 30, conv_ok: false, caiu: 900, faltou: 0, worked_min: 200, pausa_min: 0, parado_min: 0 }],
      horas: [{ h: 6, vendas: 10, valor: 300, abordagens: 10 }, { h: 12, vendas: 5, valor: 100, abordagens: 9 }],
    });
    const x = derivar({ ...rel(), atual: b }, [], periodo, "x");
    expect(x.dias.lista[0]?.conv).toBeNull();
    expect(x.horas.periodos[0]).toMatchObject({ nome: "Cedo", valor: 300 });
    expect(x.horas.melhorPeriodo?.nome).toBe("Cedo");
    expect(x.horas.barras[0]?.h).toBe(6);
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
