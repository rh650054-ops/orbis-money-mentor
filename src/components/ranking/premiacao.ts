/* DESAFIO AVANTE — premiação de novembro (Rick, 29/10/2026): R$ 500 pro 1º do mês
   (constância) e R$ 50 pro melhor vendedor de cada semana.
   08/11 (regra oficial): semana = SEGUNDA → DOMINGO, apurada segunda 06:00. Semana 1 = 02–08/11. */
export const PREMIO_INICIO = "2026-11-01";
export const PREMIO_FIM = "2026-11-30";
export const PREMIO_MES = 500;
export const PREMIO_SEMANA = 50;

export type Aba = "mensal" | "semanal";

export function lerAba(v: string | null): Aba {
  return v === "semana" || v === "semanal" ? "semanal" : "mensal";
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "Semana 2 · 09/11 a 15/11" (número só dentro de novembro; Semana 1 começa em 02/11). */
export const SEMANA_1_INICIO = "2026-11-02";
export function rotuloSemana(inicio: string, fim: string): string {
  const n = inicio >= SEMANA_1_INICIO && inicio <= PREMIO_FIM ? Math.floor((Number(inicio.slice(8, 10)) - 2) / 7) + 1 : null;
  return `${n ? `Semana ${n} · ` : ""}${ddmm(inicio)} a ${ddmm(fim)}`;
}

/** Prize line for the banner, or null outside the challenge. */
export function premioDaAba(aba: Aba, hoje: string): { valor: number; texto: string; antes: boolean } | null {
  if (hoje > PREMIO_FIM) return null;
  const antes = hoje < PREMIO_INICIO;
  return aba === "mensal"
    ? { valor: PREMIO_MES, texto: "pro 1º lugar de novembro", antes }
    : { valor: PREMIO_SEMANA, texto: "pro melhor vendedor da semana", antes };
}

/** Who takes the prize right now (Rick, 02/11): the best-placed VERIFIED seller (bank connected).
    Unverified sellers stay in the ranking but don't take the prize. null when nobody is verified. */
export function liderDoPremio<T extends { user_id: string; verificado?: boolean; faturamento_total_mes?: number | string | null }>(
  ranking: T[],
): { entry: T; pos: number; acima: number } | null {
  const i = ranking.findIndex((e) => e.verificado && Number(e.faturamento_total_mes ?? 0) > 0);
  return i < 0 ? null : { entry: ranking[i]!, pos: i + 1, acima: i };
}
