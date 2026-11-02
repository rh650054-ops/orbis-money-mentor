/* What the active profit mission says about the calendar (Rick, 01/11/2026): "o faturamento
   que eu vou fazer tem que aparecer na aba inicial" and "nos dias que eu falei que é folga,
   o app já entende que é folga pra não quebrar minha constância". Pure helpers. */
export interface DiaPlano { d: string; t: boolean; u: number }

/** Planned revenue of the whole mission: every planned unit × price (cost + profit per unit). */
export function faturamentoDoPlano(plano: DiaPlano[], custoUnid: number, lucroUnid: number): number {
  const unid = plano.reduce((s, x) => s + (x.t ? x.u : 0), 0);
  return Math.round(unid * (custoUnid + lucroUnid));
}

/** date → works that day? Only the dates inside the plan; outside it the caller falls back. */
export function mapaDeFolga(plano: DiaPlano[]): Map<string, boolean> {
  return new Map(plano.map((x) => [x.d, x.t]));
}

/** Rest day by the mission if the date is in the plan, otherwise by the profile's weekdays. */
export function ehFolga(iso: string, plano: Map<string, boolean> | null, workingDays: string[] | null | undefined): boolean {
  const t = plano?.get(iso);
  if (t !== undefined) return !t;
  if (!workingDays || workingDays.length === 0) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return !workingDays.includes(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][dow]!);
}

/** The month card numbers when a mission is active: goal = mission revenue, days left = plan work
    days from today on, needed per day = what's missing ÷ those days. Same shape, overridden. */
export function mesPelaMissao<T extends { metaMensal: number; vendidoMes: number; faltaMes: number; diasRestantes: number; precisaDia: number }>(
  m: T, faturamento: number, folgas: Map<string, boolean>, hoje: string,
): T {
  const diasRestantes = [...folgas.entries()].filter(([d, t]) => t && d >= hoje).length;
  const faltaMes = Math.max(0, faturamento - m.vendidoMes);
  return { ...m, metaMensal: faturamento, faltaMes, diasRestantes, precisaDia: Math.round(faltaMes / Math.max(1, diasRestantes) / 10) * 10 };
}
