/* Contas puras do FEZ × CAIU (sem banco, testáveis). */
export interface DiaFezCaiu { dia: string; fez: number; dinheiro: number; caiu: number | null; conferido: boolean }

/** O que não apareceu: vendido − dinheiro na mão − o que caiu no banco (nunca negativo). */
export function naoApareceu(d: DiaFezCaiu): number {
  if (d.caiu === null) return 0;
  return Math.max(0, Math.round((d.fez - d.dinheiro - d.caiu) * 100) / 100);
}

export function somaSemana(dias: DiaFezCaiu[]) {
  const fez = dias.reduce((s, d) => s + d.fez, 0);
  const caiu = dias.reduce((s, d) => s + (d.caiu ?? 0) + (d.caiu === null ? 0 : d.dinheiro), 0);
  return { fez: Math.round(fez * 100) / 100, recebido: Math.round(caiu * 100) / 100 };
}
