/* ============================================================
   RETOMAR MEU LUGAR (Lote 4, 03/10) — regra pura.
   Guardamos no aparelho a MELHOR posição do vendedor no ranking do mês
   naquele dia. Se depois de fechar o dia alguém passou ele, a Foco mostra
   "Você caiu de #12 pra #14 — RETOMAR MEU LUGAR" (volta mais uma hora).
   ============================================================ */

export const chaveLugar = (userId: string, dia: string) => `vant_lugar_${userId}_${dia}`;

/** Atualiza a melhor posição do dia e diz se ele perdeu lugar. */
export function conferirLugar(melhorAntes: number | null, atual: number | null): { melhor: number | null; caiu: number } {
  if (atual == null || atual <= 0) return { melhor: melhorAntes, caiu: 0 };
  if (melhorAntes == null || atual < melhorAntes) return { melhor: atual, caiu: 0 };
  return { melhor: melhorAntes, caiu: atual - melhorAntes };
}

export function lerMelhor(userId: string, dia: string): number | null {
  try {
    const v = Number(localStorage.getItem(chaveLugar(userId, dia)));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch { return null; }
}

export function gravarMelhor(userId: string, dia: string, pos: number | null) {
  if (pos == null) return;
  try { localStorage.setItem(chaveLugar(userId, dia), String(pos)); } catch { /* aparelho sem storage: só não lembra */ }
}
