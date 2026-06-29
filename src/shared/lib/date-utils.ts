const BRAZIL_TZ = "America/Sao_Paulo";

/**
 * Retorna a data atual no timezone do Brasil no formato YYYY-MM-DD.
 * Usa Intl.DateTimeFormat para suportar corretamente o horário de verão.
 */
export function getBrazilDate(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: BRAZIL_TZ }).format(new Date());
}

/**
 * Dia (YYYY-MM-DD) que o extrato enviado AGORA representa.
 * Regra: antes das 9h da manhã (Brasil) conta pro dia ANTERIOR — pra dar tempo
 * do Pix atrasado da véspera cair. Das 9h em diante, conta pro dia de HOJE.
 */
export function getExtratoDia(): string {
  const hour =
    Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: BRAZIL_TZ, hour: "2-digit", hour12: false }).format(new Date()),
    ) % 24;
  const today = getBrazilDate();
  if (hour >= 9) return today;
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Converte uma data Date para string no formato YYYY-MM-DD no timezone do Brasil.
 * Usa Intl.DateTimeFormat para suportar corretamente o horário de verão.
 */
export function formatBrazilDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: BRAZIL_TZ }).format(date);
}

/**
 * Retorna a hora atual no timezone do Brasil no formato HH:MM.
 */
export function getBrazilTime(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRAZIL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}
