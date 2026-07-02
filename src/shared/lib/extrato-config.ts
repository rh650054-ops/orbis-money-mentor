// Horário-limite pra subir o extrato do dia (hora do DIA SEGUINTE, fuso BR).
// Centralizado aqui pra mudar num lugar só. (Fase futura: virar ajuste no admin/banco.)
export const EXTRATO_DEADLINE_HOUR = 9; // 9h da manhã do dia seguinte

export function extratoDeadlineLabel(): string {
  return `${EXTRATO_DEADLINE_HOUR}h`;
}
