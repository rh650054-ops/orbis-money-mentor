/* DESAFIO AVANTE — premiação de novembro (Rick, 29/10/2026): R$ 500 pro 1º do mês
   (constância) e R$ 50 pro melhor vendedor de cada semana (domingo → sábado). */
export const PREMIO_INICIO = "2026-11-01";
export const PREMIO_FIM = "2026-11-30";
export const PREMIO_MES = 500;
export const PREMIO_SEMANA = 50;

export type Aba = "mensal" | "semanal";

export function lerAba(v: string | null): Aba {
  return v === "semana" || v === "semanal" ? "semanal" : "mensal";
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "Semana 2 · 08/11 a 14/11" (número só dentro de novembro). */
export function rotuloSemana(inicio: string, fim: string): string {
  const n = inicio >= PREMIO_INICIO && inicio <= PREMIO_FIM ? Math.floor((Number(inicio.slice(8, 10)) - 1) / 7) + 1 : null;
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
