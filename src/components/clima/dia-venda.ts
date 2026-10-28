/* ============================================================
   RESUMO DO DIA PELO HORÁRIO DE VENDA (Rick, 27/10/2026 — "o clima tá bugado").
   O resumo diário vinha de UM modelo olhando as 24 h: o ícone era o pior código
   do dia (uma garoa de 0,1 mm às 8h virava "dia de garoa"; neblina às 6h virava
   "dia de neblina") e o % era a maior chance de qualquer hora (86% pra 0,9 mm).
   Aqui o dia é refeito com as horas de 7h a 21h, que já trazem a chance de consenso:
   - chuva que atrapalha = hora com ≥ 0,5 mm; garoa = pingos que somam menos que isso;
   - % = maior chance entre as horas que de fato chovem (≥ 0,2 mm); sem elas, no máx. 20%;
   - ícone = o tempo predominante de dia, só vira chuva quando a chuva é de verdade.
   ============================================================ */
import type { DiaClima, Tempo } from "@/hooks/useClima";

const INI = 7;
const FIM = 21;

/** WMO: 0 limpo · 1-3 nuvens · 45/48 neblina · 51-57 garoa · 61-67 chuva · 80-82 pancadas · 95-99 trovoada */
function moda(codigos: number[]): number {
  const conta = new Map<number, number>();
  for (const c of codigos) conta.set(c, (conta.get(c) ?? 0) + 1);
  let melhor = 2, n = -1;
  for (const [c, k] of conta) if (k > n || (k === n && c > melhor)) { melhor = c; n = k; }
  return melhor;
}

export function diaDeVenda(d: DiaClima): DiaClima & { garoa: boolean; mmVenda: number } {
  const hs = d.horas.filter((h) => h.hora >= INI && h.hora <= FIM);
  // 27/10 (Rick): the screen shows the whole-day chance like the iPhone (probDia); `prob`
  // stays the selling-hours chance used by the decision engine and Objetivo de Lucro.
  const probDia = d.probDia ?? d.prob;
  if (hs.length === 0) return { ...d, probDia, garoa: false, mmVenda: d.mm ?? 0 };
  const mmVenda = hs.reduce((s, h) => s + (h.mm || 0), 0);
  const chovendo = hs.filter((h) => (h.mm || 0) >= 0.2);
  const forte = hs.filter((h) => (h.mm || 0) >= 0.5);
  const trovoada = hs.some((h) => (h.codigo ?? 0) >= 95 && (h.mm || 0) >= 0.5);
  const maxChance = Math.max(0, ...hs.map((h) => h.chance ?? 0));
  const prob = chovendo.length ? Math.round(Math.max(...chovendo.map((h) => h.chance ?? 0))) : Math.min(20, Math.round(maxChance));

  let codigo: number;
  if (trovoada) codigo = 95;
  else if (forte.length >= 1) {
    const pesada = forte.some((h) => (h.mm || 0) >= 2);
    codigo = pesada ? 81 : forte.length >= 3 ? 63 : 80;
  } else if (mmVenda >= 0.3) codigo = 51;
  else {
    // Tempo seco: o céu predominante das 10h às 17h (neblina da manhã não manda no dia).
    const meio = hs.filter((h) => h.hora >= 10 && h.hora <= 17).map((h) => Math.min(3, h.codigo ?? 2));
    codigo = moda(meio.length ? meio : hs.map((h) => Math.min(3, h.codigo ?? 2)));
  }
  return { ...d, codigo, prob, probDia, garoa: forte.length === 0 && mmVenda >= 0.3, mmVenda: Math.round(mmVenda * 10) / 10 };
}

/** Aplica o resumo de venda a todos os dias da resposta (inclusive o que vem do cache). */
export function ajustarTempo(t: Tempo): Tempo {
  if (!t?.dias?.length) return t;
  return { ...t, dias: t.dias.map(diaDeVenda) };
}
