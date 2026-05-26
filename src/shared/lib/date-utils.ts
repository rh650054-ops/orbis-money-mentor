const BRAZIL_TZ = "America/Sao_Paulo";

/**
 * Retorna a data atual no timezone do Brasil no formato YYYY-MM-DD.
 * Usa Intl.DateTimeFormat para suportar corretamente o horário de verão.
 */
export function getBrazilDate(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: BRAZIL_TZ }).format(new Date());
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
