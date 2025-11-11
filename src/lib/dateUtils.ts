/**
 * Retorna a data atual no timezone do Brasil (UTC-3) no formato YYYY-MM-DD
 */
export function getBrazilDate(): string {
  const now = new Date();
  // UTC-3 (horário de Brasília)
  const brazilOffset = -3 * 60; // -180 minutos
  const localOffset = now.getTimezoneOffset();
  const diffMinutes = localOffset + brazilOffset;
  
  const brazilTime = new Date(now.getTime() - diffMinutes * 60 * 1000);
  
  const year = brazilTime.getFullYear();
  const month = String(brazilTime.getMonth() + 1).padStart(2, '0');
  const day = String(brazilTime.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Converte uma data Date para string no formato YYYY-MM-DD no timezone do Brasil
 */
export function formatBrazilDate(date: Date): string {
  const brazilOffset = -3 * 60;
  const localOffset = date.getTimezoneOffset();
  const diffMinutes = localOffset + brazilOffset;
  
  const brazilTime = new Date(date.getTime() - diffMinutes * 60 * 1000);
  
  const year = brazilTime.getFullYear();
  const month = String(brazilTime.getMonth() + 1).padStart(2, '0');
  const day = String(brazilTime.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}
