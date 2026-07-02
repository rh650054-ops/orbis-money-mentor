import { EXTRATO_DEADLINE_HOUR } from "./extrato-config";

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
 * Regra: antes do HORÁRIO-LIMITE (EXTRATO_DEADLINE_HOUR, ex: 9h, fuso Brasil) conta
 * pro dia ANTERIOR — pra dar tempo do Pix atrasado da véspera cair. Do limite em
 * diante, conta pro dia de HOJE. (Horário centralizado em extrato-config.ts.)
 */
export function getExtratoDia(): string {
  const hour =
    Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: BRAZIL_TZ, hour: "2-digit", hour12: false }).format(new Date()),
    ) % 24;
  const today = getBrazilDate();
  if (hour >= EXTRATO_DEADLINE_HOUR) return today;
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
 * Primeiro dia do mês atual (YYYY-MM-DD) no timezone do Brasil.
 * Use para montar o range "do começo do mês até hoje" sem escorregar de fuso.
 */
export function getBrazilMonthStart(): string {
  return getBrazilDate().slice(0, 7) + "-01";
}

/**
 * Data (YYYY-MM-DD) N dias antes de HOJE no timezone do Brasil.
 * Aritmética de calendário a partir da data BR (sem drift de fuso).
 */
export function getBrazilDateDaysAgo(days: number): string {
  const [y, m, d] = getBrazilDate().split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
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
