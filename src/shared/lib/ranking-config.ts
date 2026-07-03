// Data em que o EXTRATO passa a valer no ranking (verificação anti-fraude).
// Antes desta data: modo ao vivo (usa o DEFCON na hora).
// A partir dela: só conta no ranking o valor que tem EXTRATO enviado/verificado.
//
// IMPORTANTE: isto é DESACOPLADO da abertura da temporada oficial (06/07, em
// useWeeklyLeaderboard.TEMPORADA_INICIO, que controla a JANELA da semana).
// Aqui é só a exigência do comprovante — dá pra antecipar sem mexer na janela.
export const EXTRATO_VALENDO = "2026-07-02";

// Recebe a data de hoje no fuso BR ("YYYY-MM-DD") e diz se o extrato já vale.
export function extratoValendo(hojeISO: string): boolean {
  return hojeISO >= EXTRATO_VALENDO;
}
