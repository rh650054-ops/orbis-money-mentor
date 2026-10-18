/* Reconciliation math for the Vender screen. Pure, so the states are tested.
   Cash in hand never goes through the bank: the bank is expected to show
   what was sold minus cash. (The old hero forgot the cash and showed it as
   "ainda não caíram".) */
import type { DiaConc, Estado } from "../types";

const r2 = (v: number) => Math.round(v * 100) / 100;

export const esperado = (d: DiaConc) => r2(Math.max(0, d.fez - d.dinheiro));
export const falta = (d: DiaConc) => (d.caiu === null ? 0 : r2(Math.max(0, esperado(d) - d.caiu)));
export const aMais = (d: DiaConc) => (d.caiu === null ? 0 : r2(Math.max(0, d.caiu - esperado(d))));
/** What was really received: bank + cash in hand. */
export const recebido = (d: DiaConc) => r2((d.caiu ?? 0) + (d.caiu === null ? 0 : d.dinheiro));

export function progresso(d: DiaConc): number {
  const e = esperado(d);
  if (d.caiu === null) return 0;
  if (e <= 0) return d.caiu > 0 ? 100 : 0;
  return Math.min(100, Math.round((d.caiu / e) * 100));
}

/** Tolerance of R$ 1 for rounding and card fees. */
export function estadoDoDia(d: DiaConc): Estado {
  if (d.fez <= 0) return "sem_venda";
  if (falta(d) < 1) return d.depois >= 1 ? "depois" : "ok";
  if (!d.conferido) return "aguardando";
  return (d.caiu ?? 0) > 0 ? "parcial" : "nada";
}

/** The hero shows today, or yesterday while yesterday's Foco is the latest one. */
export function diaDoHeroi(dias: DiaConc[], hoje: string): DiaConc {
  const ontem = new Date(`${hoje}T12:00:00Z`);
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  const dOntem = ontem.toISOString().slice(0, 10);
  const h = dias.find((d) => d.dia === hoje);
  if (h && h.fez > 0) return h;
  const o = dias.find((d) => d.dia === dOntem);
  if (o && o.fez > 0) return o;
  return h ?? { dia: hoje, fez: 0, dinheiro: 0, caiu: 0, depois: 0, pessoal: 0, qtd: 0, conferido: false };
}

export function resumoSemana(dias: DiaConc[]) {
  const vendas = dias.filter((d) => d.fez > 0);
  const fez = r2(vendas.reduce((s, d) => s + d.fez, 0));
  const caiu = r2(vendas.reduce((s, d) => s + recebido(d), 0));
  return { fez, caiu, diferenca: r2(Math.max(0, fez - caiu)), dias: vendas.length };
}
