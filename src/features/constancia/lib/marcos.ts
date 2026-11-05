/* Milestones of the flame (the big full-screen moments) and the "meta de constância" bar. */
export const MARCOS = [1, 3, 7, 14, 30, 60, 100, 180, 365, 730] as const;

/** Next milestone above `dias` (730 stays as the last). */
export function proximoMarco(dias: number): number {
  return MARCOS.find((m) => m > dias) ?? MARCOS[MARCOS.length - 1]!;
}

/** Previous milestone reached (0 before the first). */
export function marcoAnterior(dias: number): number {
  const feitos = MARCOS.filter((m) => m <= dias);
  return feitos.length ? feitos[feitos.length - 1]! : 0;
}

export function ehMarco(dias: number): boolean {
  return (MARCOS as readonly number[]).includes(dias);
}

export function nomeDoMarco(m: number): string {
  switch (m) {
    case 1: return "acendeu";
    case 3: return "pegou força";
    case 7: return "fogueira";
    case 14: return "2 semanas";
    case 30: return "1 mês";
    case 60: return "2 meses";
    case 100: return "centena";
    case 180: return "meio ano";
    case 365: return "1 ano";
    default: return `${m} dias`;
  }
}
