import type { Bloco, DiaBanco, DiaRel, Periodo, Relatorio } from "../types";
import { addDias, brl, diaDaSemana, ehUmDia, fmtMinSeg, pct, semanaCurta, semanaLonga, ddmm } from "./periodo";

/* Turns the raw RPC blocks (+ the bank check) into exactly what each card shows.
   Every number on the screen is computed here, once, so it is testable and never
   repeated with a different formula in two components. */

export interface Delta { valor: number; texto: string; tom: "up" | "down" | "flat" }

/** A day row with what was sold (caiu + faltou) and its conversion. */
export type DiaLista = DiaRel & { vendido: number; conv: number | null };

export interface Insight { tom: "gold" | "ok" | "bad"; titulo: string; texto: string }

export interface PeriodoDia { nome: string; faixa: string; de: number; ate: number; valor: number; vendas: number; abordagens: number; conv: number | null }

export interface Resumo {
  periodo: Periodo;
  umDia: boolean;
  semDados: boolean;
  diasNaRua: number;
  dinheiro: {
    vendeu: number; caiu: number; faltou: number; gastos: number; sobrou: number;
    pctCaiu: number; pctSobrou: number; pctGastou: number; pctNaoCaiu: number; deCada10: number;
    delta: Delta | null; vendas: number;
  };
  vendas: {
    abordagens: number; vendas: number; conv: number | null; convNormal: number | null; deltaConv: Delta | null;
    abordPorVenda: number | null; abordPorVendaNormal: number | null; abordDia: number; vendasDia: number;
    ticket: number | null; ticketNormal: number | null; abordagemCadaMin: number | null; ritmoMin: number | null;
    melhorRitmo: { dia: string; min: number } | null;
  };
  dias: {
    lista: DiaLista[];
    melhor: DiaLista | null; maisEficiente: (DiaLista & { conv: number }) | null; maisFraco: DiaLista | null;
    maxCaiu: number; // max "vendido" of a day (bar scale)
  };
  horas: { periodos: PeriodoDia[]; melhorPeriodo: PeriodoDia | null; shareMelhor: number; barras: { h: number; valor: number }[]; melhorHora: { h: number; valor: number; vendas: number } | null; piorHora: { h: number; valor: number } | null };
  tempo: {
    worked: number; pausa: number; parado: number; ativo: number; pctAtivo: number; pctPausa: number; pctParado: number;
    porDia: number; pausas: { motivo: string; n: number; min: number }[]; maior: { dia: string; min: number } | null; menor: { dia: string; min: number } | null;
  };
  recebeu: { metodos: { chave: string; nome: string; n: number; valor: number; pctN: number }[]; gorjeta: Bloco["vendas"]["gorjeta"]; caiuDepois: number; totalN: number };
  gastos: {
    total: number; porDia: number; deCada10: number; deCada10Anterior: number | null; deltaDeCada10: Delta | null;
    linhas: { chave: string; nome: string; valor: number; pctTotal: number; porDia: number }[];
  };
  calote: {
    /** "caiu depois" lido do banco (automático) em vez do registro manual */
    peloBanco: boolean;
    total: number; recuperado: number; perdido: number; taxa: number | null; porDia: number; umACada: number | null;
    pctVendeu: number; normalPct: number; vezesNormal: number | null; unidades: number;
  };
  insights: Insight[];
}

const NOMES_PAUSA: Record<string, string> = { conversar: "conversa", almoco: "almoço", banheiro: "banheiro", outro: "outro" };
const NOMES_METODO: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão" };
const PERIODOS: { nome: string; faixa: string; de: number; ate: number }[] = [
  { nome: "Manhã", faixa: "8–11h", de: 8, ate: 11 },
  { nome: "Almoço", faixa: "11–14h", de: 11, ate: 14 },
  { nome: "Tarde", faixa: "14–18h", de: 14, ate: 18 },
  { nome: "Noite", faixa: "18–24h", de: 18, ate: 24 },
];

function deltaPct(atual: number, anterior: number, rotulo: string): Delta | null {
  if (!(anterior > 0)) return null;
  const v = Math.round(((atual - anterior) / anterior) * 100);
  return { valor: v, texto: `${v > 0 ? "↑" : v < 0 ? "↓" : "="} ${Math.abs(v)}% vs ${rotulo}`, tom: v > 0 ? "up" : v < 0 ? "down" : "flat" };
}

function deltaPp(atual: number | null, ref: number | null, rotulo: string): Delta | null {
  if (atual == null || ref == null) return null;
  const v = Math.round(atual - ref);
  return { valor: v, texto: `${v > 0 ? "↑" : v < 0 ? "↓" : "="} ${Math.abs(v)} p.p. vs ${rotulo}`, tom: v > 0 ? "up" : v < 0 ? "down" : "flat" };
}

/** `caiuDepoisBanco`: Pix que caiu depois de fechar o Foco, lido do banco (Open Finance).
 *  Com ele o "caiu depois" é automático; sem ele vale o registro manual (late_pix). */
export function derivar(rel: Relatorio, banco: DiaBanco[], periodo: Periodo, rotuloAnt: string, caiuDepoisBanco: { total: number; n: number } | null = null): Resumo {
  const a = rel.atual, ant = rel.anterior, nor = rel.normal;
  const umDia = ehUmDia(periodo);
  const diasNaRua = Math.max(1, a.dias_na_rua);

  // Money: bank days replace typed Pix/card with what the bank actually saw (same rule as before).
  const ajuste = banco.reduce((t, d) => ({ caiu: t.caiu + (d.caiu - d.pix_cartao), faltou: t.faltou + d.faltou }), { caiu: 0, faltou: 0 });
  const caiu = Math.max(0, a.dinheiro.caiu + ajuste.caiu);
  const faltou = Math.max(0, a.dinheiro.faltou + ajuste.faltou);
  const vendeu = caiu + faltou;
  const gastos = a.dinheiro.gastos;
  const sobrou = caiu - gastos;
  const vendas = a.vendas.vendas;

  const conv = a.vendas.conversao;
  const ativo = a.tempo.ativo_min;
  // PR #126 (18/10): "faturamento" is what was SOLD (caiu + faltou). Ticket, best day and
  // the day list follow that; "sobrou" stays caiu − gastos (money really in the pocket).
  const ticket = vendas > 0 ? vendeu / vendas : null;

  const lista = a.dias.map((d) => ({ ...d, vendido: Math.round((d.caiu + d.faltou) * 100) / 100, conv: d.abordagens > 0 ? Math.round((d.vendas / d.abordagens) * 100) : null }));
  const comVenda = lista.filter((d) => d.vendido > 0 || d.vendas > 0);
  const melhor = comVenda.reduce<DiaLista | null>((m, d) => (!m || d.vendido > m.vendido ? d : m), null);
  const maisEficiente = lista.filter((d): d is DiaLista & { conv: number } => d.conv != null && d.vendas >= 5)
    .reduce<(DiaLista & { conv: number }) | null>((m, d) => (!m || d.conv > m.conv ? d : m), null);
  const maisFraco = comVenda.length > 1 ? comVenda.reduce<DiaLista | null>((m, d) => (!m || d.vendido < m.vendido ? d : m), null) : null;
  const maxCaiu = Math.max(0, ...lista.map((d) => d.vendido));

  const horasMap = new Map(a.horas.map((h) => [h.h, h]));
  const periodos: PeriodoDia[] = PERIODOS.map((p) => {
    let valor = 0, vds = 0, ab = 0;
    for (let h = p.de; h < p.ate; h++) { const x = horasMap.get(h); if (x) { valor += x.valor; vds += x.vendas; ab += x.abordagens; } }
    return { ...p, valor, vendas: vds, abordagens: ab, conv: ab > 0 ? Math.min(100, Math.round((vds / ab) * 100)) : null };
  });
  const totalPeriodos = periodos.reduce((s, p) => s + p.valor, 0);
  const melhorPeriodo = totalPeriodos > 0 ? periodos.reduce((m, p) => (p.valor > m.valor ? p : m)) : null;
  const barras = Array.from({ length: 16 }, (_, i) => ({ h: 8 + i, valor: horasMap.get(8 + i)?.valor ?? 0 }));
  const comVendaHora = a.horas.filter((h) => h.vendas > 0);
  const melhorHora = comVendaHora.length ? comVendaHora.reduce((m, h) => (h.valor > m.valor ? h : m)) : null;
  const piorHora = comVendaHora.length > 1 ? comVendaHora.reduce((m, h) => (h.valor < m.valor ? h : m)) : null;

  const worked = a.tempo.worked_min;
  const pausas = Object.entries(a.tempo.pausas).map(([k, v]) => ({ motivo: NOMES_PAUSA[k] ?? k, n: v.n, min: v.min })).sort((x, y) => y.min - x.min);
  const diasComTempo = lista.filter((d) => d.worked_min >= 15);
  const menor = diasComTempo.length ? diasComTempo.reduce((m, d) => (d.worked_min < m.worked_min ? d : m)) : null;

  const metodos = ["pix", "dinheiro", "cartao"].map((k) => {
    const m = a.vendas.metodos[k];
    return { chave: k, nome: NOMES_METODO[k]!, n: m?.n ?? 0, valor: m?.valor ?? 0, pctN: pct(m?.n ?? 0, vendas) };
  });

  const deCada10Gasto = vendeu > 0 ? (gastos / vendeu) * 10 : 0;
  const vendeuAnt = ant.dinheiro.vendeu;
  const deCada10GastoAnt = vendeuAnt > 0 ? (ant.dinheiro.gastos / vendeuAnt) * 10 : null;
  const linhasGasto = (["mercadoria", "transporte", "alimentacao", "outros"] as const)
    .map((k) => ({ chave: k, nome: k === "alimentacao" ? "Alimentação" : k[0]!.toUpperCase() + k.slice(1), valor: a.dinheiro[k], pctTotal: pct(a.dinheiro[k], gastos), porDia: a.dinheiro[k] / diasNaRua }))
    .filter((l) => l.chave !== "outros" || l.valor > 0);

  // Banco: total_debt já está conferido com tudo que caiu (antes e depois do fim do Foco),
  // então o calote "na hora" é o que faltou + o que caiu depois.
  const peloBanco = caiuDepoisBanco != null;
  const calTotal = peloBanco ? faltou + caiuDepoisBanco.total : faltou;
  const calRecuperado = peloBanco ? caiuDepoisBanco.total : Math.min(calTotal, a.calote.recuperado);
  const calPerdido = Math.max(0, calTotal - calRecuperado);
  const calUnid = a.calote.unidades > 0 ? a.calote.unidades : ticket && ticket > 0 ? Math.round(calTotal / ticket) : 0;
  const calPct = vendeu > 0 ? (calTotal / vendeu) * 100 : 0;
  const normalPct = nor.dinheiro.vendeu > 0 ? (nor.dinheiro.faltou / nor.dinheiro.vendeu) * 100 : 0;

  const resumo: Resumo = {
    periodo, umDia, semDados: vendeu <= 0 && vendas <= 0 && worked <= 0, diasNaRua: a.dias_na_rua,
    dinheiro: {
      vendeu, caiu, faltou, gastos, sobrou, vendas,
      pctCaiu: pct(caiu, vendeu), pctSobrou: pct(Math.max(0, sobrou), vendeu), pctGastou: pct(gastos, vendeu), pctNaoCaiu: pct(faltou, vendeu),
      deCada10: vendeu > 0 ? (Math.max(0, sobrou) / vendeu) * 10 : 0,
      delta: deltaPct(vendeu, vendeuAnt, rotuloAnt),
    },
    vendas: {
      abordagens: a.vendas.abordagens, vendas, conv, convNormal: nor.vendas.conversao,
      deltaConv: deltaPp(conv, ant.vendas.conversao, rotuloAnt),
      abordPorVenda: a.vendas.abordagens_por_venda, abordPorVendaNormal: nor.vendas.abordagens_por_venda,
      abordDia: a.vendas.abordagens / diasNaRua, vendasDia: vendas / diasNaRua,
      ticket, ticketNormal: nor.vendas.ticket,
      abordagemCadaMin: a.vendas.abordagens > 0 && ativo > 0 ? ativo / a.vendas.abordagens : null,
      ritmoMin: vendas > 0 && ativo > 0 ? ativo / vendas : null,
      melhorRitmo: a.tempo.melhor_ritmo,
    },
    dias: { lista, melhor, maisEficiente, maisFraco, maxCaiu },
    horas: { periodos, melhorPeriodo, shareMelhor: melhorPeriodo ? pct(melhorPeriodo.valor, totalPeriodos) : 0, barras, melhorHora, piorHora },
    tempo: {
      worked, pausa: a.tempo.pausa_min, parado: a.tempo.parado_min, ativo,
      pctAtivo: pct(ativo, worked), pctPausa: pct(a.tempo.pausa_min, worked), pctParado: pct(a.tempo.parado_min, worked),
      porDia: worked / diasNaRua, pausas, maior: a.tempo.maior_dia, menor: menor ? { dia: menor.dia, min: menor.worked_min } : null,
    },
    recebeu: { metodos, gorjeta: a.vendas.gorjeta, caiuDepois: a.calote.recuperado, totalN: vendas },
    gastos: {
      total: gastos, porDia: gastos / diasNaRua, deCada10: deCada10Gasto, deCada10Anterior: deCada10GastoAnt,
      deltaDeCada10: deCada10GastoAnt != null ? { valor: deCada10Gasto - deCada10GastoAnt, texto: `${deCada10Gasto >= deCada10GastoAnt ? "↑" : "↓"} ${brl(Math.abs(deCada10Gasto - deCada10GastoAnt), true)}`, tom: deCada10Gasto > deCada10GastoAnt ? "down" : deCada10Gasto < deCada10GastoAnt ? "up" : "flat" } : null,
      linhas: linhasGasto,
    },
    calote: {
      peloBanco,
      total: calTotal, recuperado: calRecuperado, perdido: calPerdido,
      taxa: calTotal > 0 ? Math.round((calRecuperado / calTotal) * 100) : null,
      porDia: calPerdido / diasNaRua, umACada: calUnid > 0 && vendas > 0 ? Math.round(vendas / calUnid) : null,
      pctVendeu: calPct, normalPct, vezesNormal: normalPct > 0 && calPct > 0 ? Math.round((calPct / normalPct) * 10) / 10 : null, unidades: calUnid,
    },
    insights: [],
  };
  resumo.insights = montarInsights(resumo, rel, rotuloAnt);
  return resumo;
}

/** Up to 3 sentences, each one born from a real number of the period. */
export function montarInsights(r: Resumo, rel: Relatorio, rotuloAnt: string): Insight[] {
  const out: Insight[] = [];
  const ant = rel.anterior;
  const d = r.dinheiro;
  // 1. Worse revenue but same pace → shorter period, not weaker
  if (d.delta && d.delta.valor <= -15 && ant.tempo.worked_min > 0 && r.tempo.worked > 0) {
    const porHoraAt = d.vendeu / (r.tempo.worked / 60), porHoraAnt = ant.dinheiro.vendeu / (ant.tempo.worked_min / 60);
    if (porHoraAnt > 0 && porHoraAt >= porHoraAnt * 0.9) {
      out.push({ tom: "gold", titulo: "Período mais curto, não mais fraco.", texto: `Você vendeu ${Math.abs(d.delta.valor)}% menos que ${rotuloAnt} porque ficou menos tempo na rua; por hora, vendeu ${porHoraAt > porHoraAnt * 1.05 ? "mais" : "o mesmo"}.` });
    }
  }
  // 2. Calote vs normal
  if (r.calote.total > 0 && r.calote.vezesNormal != null && r.calote.vezesNormal >= 2) {
    out.push({ tom: "bad", titulo: "O calote pesou.", texto: `${brl(r.calote.total)} não caíram na hora — ${r.calote.vezesNormal}× o seu normal. ${r.calote.recuperado > 0 ? `${brl(r.calote.recuperado)} já voltaram em Pix depois; ` : ""}${brl(r.calote.perdido)} ficaram perdidos.` });
  }
  // 3. Conversion up vs normal
  if (r.vendas.conv != null && r.vendas.convNormal != null && r.vendas.conv >= r.vendas.convNormal + 3 && out.length < 3) {
    out.push({ tom: "ok", titulo: "Você está mais eficiente.", texto: `Sua conversão foi ${Math.round(r.vendas.conv)}% contra ${Math.round(r.vendas.convNormal)}% do seu normal${r.vendas.ritmoMin ? ` — 1 venda a cada ${fmtMinSeg(r.vendas.ritmoMin)} vendendo` : ""}.` });
  }
  // 4. Best period of the day
  if (r.horas.melhorPeriodo && r.horas.shareMelhor >= 35 && out.length < 3) {
    const p = r.horas.melhorPeriodo;
    out.push({ tom: "gold", titulo: `${p.nome === "Almoço" ? "Hora do almoço" : p.nome} é a sua hora.`, texto: `${p.faixa} deram ${r.horas.shareMelhor}% do que você vendeu${r.horas.melhorHora ? `; ${r.horas.melhorHora.h}h foi a melhor hora, com ${r.horas.melhorHora.vendas} vendas` : ""}.` });
  }
  // 5. Chatting eats time
  const conversa = r.tempo.pausas.find((p) => p.motivo === "conversa");
  if (conversa && conversa.min >= 60 && conversa.min >= r.tempo.pausa * 0.5 && out.length < 3) {
    out.push({ tom: "bad", titulo: "Conversa está comendo seu tempo.", texto: `${conversa.n} pausas pra conversar somaram ${Math.round(conversa.min / 60 * 10) / 10}h — ${Math.round((conversa.min / r.tempo.pausa) * 100)}% de todas as suas pausas.` });
  }
  // 6. Best day
  if (r.dias.melhor && !r.umDia && out.length < 3) {
    const m = r.dias.melhor;
    out.push({ tom: "gold", titulo: `${semanaLonga(m.dia)[0]!.toUpperCase()}${semanaLonga(m.dia).slice(1)} ${ddmm(m.dia)} foi seu melhor dia.`, texto: `${brl(m.vendido)} em ${m.vendas} vendas${m.abordagens > 0 ? `, ${Math.round((m.vendas / m.abordagens) * 100)}% de conversão` : ""}.` });
  }
  return out.slice(0, 3);
}

export const letraSemana = (iso: string) => semanaCurta(iso)[0]!.toUpperCase();
export const ehFimDeSemana = (iso: string) => [0, 6].includes(diaDaSemana(iso));
