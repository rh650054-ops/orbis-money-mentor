/* ============================================================
   MÊS BLINDADO — as contas do mês, em regra pura (sem tela, sem banco).
   (Lote 3 de Finanças, mockups mock-financas / mock-financas-vicio, 03/10)
   • guardadoMedioDia: quanto ele de fato guardou por dia de trabalho
     (financas_dias) nas últimas 2 semanas.
   • diasUteisAteBlindar: no ritmo de hoje, em quantos dias úteis o que
     falta das contas fica coberto.
   • recadoBlindado: UM recado — "você guarda X% do lucro, suas contas
     pedem Y%" + o que fazer.
   • seloConta: o selo de cada conta na lista (VENCEU, BLINDADA, VENCE HOJE…).
   ============================================================ */
import { formatCurrency } from "@/shared/lib/utils";

const NOMES_DIA = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** YYYY-MM-DD de um Date em horário local (o app já trabalha com data de Brasília). */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Média guardada por DIA DE TRABALHO nos últimos `janela` dias corridos (sem contar hoje). */
export function guardadoMedioDia(
  dias: Record<string, number>,
  diasTrabalho: string[] | null | undefined,
  hoje: Date,
  janela = 14,
): number {
  let soma = 0;
  let uteis = 0;
  for (let i = 1; i <= janela; i++) {
    const d = new Date(hoje);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const util = diasTrabalho && diasTrabalho.length > 0 ? diasTrabalho.includes(NOMES_DIA[d.getDay()] ?? "") : true;
    const v = Number(dias[ymd(d)]) || 0;
    if (util) uteis++;
    soma += v;
  }
  return uteis > 0 ? Math.round((soma / uteis) * 100) / 100 : 0;
}

/** Dias úteis até cobrir o que falta, guardando `porDia`. null = nesse ritmo não fecha. */
export function diasUteisAteBlindar(falta: number, porDia: number): number | null {
  if (falta <= 0.005) return 0;
  if (porDia <= 0.005) return null;
  return Math.ceil(falta / porDia);
}

export interface Recado { titulo: string; texto: string; tom: "ok" | "ouro" }

export function recadoBlindado(p: {
  falta: number;            // quanto das contas abertas ainda não está guardado
  ritmoContas: number;      // R$/dia útil que as contas pedem
  guardaDia: number;        // R$/dia útil que ele guarda de fato
  lucroDia: number;         // lucro líquido médio por dia trabalhado
  proxima: { nome: string; dia: string } | null; // próxima conta a vencer, "dia 10"
  diaBlindado: string | null; // "dia 19" no ritmo dele
}): Recado | null {
  if (p.ritmoContas <= 0.005 && p.falta <= 0.005) return null;
  if (p.falta <= 0.005) {
    return { tom: "ok", titulo: "Mês blindado.", texto: "Todas as contas do mês já estão guardadas. O que sobrar agora vai pras caixinhas." };
  }
  const pct = (v: number) => (p.lucroDia > 0 ? Math.round((v / p.lucroDia) * 100) : 0);
  const temPct = p.lucroDia > 0;
  if (p.guardaDia + 0.5 < p.ritmoContas) {
    const amais = Math.ceil(p.ritmoContas - p.guardaDia);
    return {
      tom: "ouro",
      titulo: temPct
        ? `Você guarda ${pct(p.guardaDia)}% do lucro. Suas contas pedem ${pct(p.ritmoContas)}%.`
        : `Suas contas pedem ${formatCurrency(p.ritmoContas)} por dia de trabalho.`,
      texto: p.proxima
        ? `Com ${formatCurrency(amais)} a mais por dia, ${p.proxima.nome} chega paga no ${p.proxima.dia} sem aperto.`
        : `Com ${formatCurrency(amais)} a mais por dia, o mês fecha sem dever nada.`,
    };
  }
  return {
    tom: "ok",
    titulo: temPct
      ? `Você guarda ${pct(p.guardaDia)}% do lucro, acima dos ${pct(p.ritmoContas)}% que as contas pedem.`
      : "Você está guardando no ritmo que as contas pedem.",
    texto: p.diaBlindado ? `Nesse ritmo o mês fecha blindado no ${p.diaBlindado}.` : "Nesse ritmo o mês fecha sem dever nada.",
  };
}

export type Selo = { texto: string; cor: "red" | "ok" | "ouro" | "mute" } | null;

/** O selo ao lado do nome da conta na lista. */
export function seloConta(c: { paga: boolean; vencida: boolean; coberta: boolean; diasAteVencer: number | null }): Selo {
  if (c.paga) return { texto: "PAGA", cor: "mute" };
  if (c.vencida) {
    const n = Math.abs(c.diasAteVencer ?? 0);
    return { texto: n <= 1 ? "VENCEU ONTEM" : `VENCEU HÁ ${n} DIAS`, cor: "red" };
  }
  if (c.coberta) return { texto: "BLINDADA", cor: "ok" };
  if (c.diasAteVencer === 0) return { texto: "VENCE HOJE", cor: "ouro" };
  if (c.diasAteVencer === 1) return { texto: "VENCE AMANHÃ", cor: "ouro" };
  return null;
}
