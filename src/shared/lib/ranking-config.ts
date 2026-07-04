// RANKING GLOBAL: o extrato NÃO é mais exigido no ranking (decisão do produto).
// Todo mundo entra com o valor cheio (cartão + pix + dinheiro) do DEFCON, sem
// precisar enviar comprovante. O antibula continua (admin pode ocultar fraudador,
// e a IA de anomalia do DEFCON segue rodando).
// Data no futuro distante = extrato nunca "liga". Se um dia quiserem voltar a
// exigir extrato, é só trocar esta data.
export const EXTRATO_VALENDO = "2099-01-01";

// Recebe a data de hoje no fuso BR ("YYYY-MM-DD") e diz se o extrato já vale.
export function extratoValendo(hojeISO: string): boolean {
  return hojeISO >= EXTRATO_VALENDO;
}
