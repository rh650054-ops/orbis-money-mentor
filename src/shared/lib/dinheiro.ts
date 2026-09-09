/* ============================================================
   DINHEIRO — um jeito só de ler e mostrar valor em real.

   Por que isso existe (09/09/2026):

   1) O campo de valor da venda no DEFCON era <input type="number">. No
      teclado brasileiro a tecla do decimal é a VÍRGULA, e o type=number
      recusa vírgula: o vendedor via "12," na tela, o React recebia "" e
      os botões DINHEIRO / PIX / CARTÃO ficavam apagados. Ele não conseguia
      registrar a venda — que é a única coisa que ele realmente precisa
      fazer no Orbis.

   2) O campo de valor da cobrança fazia replace(/\./g, "") achando que
      todo ponto é separador de milhar. Quem digitasse 12.50 gerava um Pix
      de R$ 1.250,00 — cobrança real, na carteira dele, mandada no
      WhatsApp de um cliente real.

   A saída é a mesma que o MoneyInput já usava e que todo app de banco usa:
   o campo só aceita DÍGITO, e os dois últimos são os centavos.
   "1250" → R$ 12,50. Sem vírgula, sem ponto, sem ambiguidade.
   ============================================================ */

/** só os dígitos, limitado pra não estourar (999.999.999,99) */
export const soDigitosValor = (texto: string | null | undefined) =>
  String(texto ?? "").replace(/\D/g, "").slice(0, 11);

/** "1250" → 12.5   ·   "" → 0 */
export function reaisDeDigitos(texto: string | null | undefined): number {
  const d = soDigitosValor(texto);
  if (!d) return 0;
  return Math.round(parseInt(d, 10)) / 100;
}

/** 12.5 → "12,50"   ·   0 → "" (pra o placeholder aparecer) */
export function textoDeDigitos(texto: string | null | undefined): string {
  const d = soDigitosValor(texto);
  if (!d) return "";
  return (parseInt(d, 10) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 12.5 → "1250" — pra pré-preencher um campo a partir de um número salvo */
export const digitosDeReais = (n: number | null | undefined) =>
  !n || n <= 0 ? "" : String(Math.round(n * 100));

/* ---------- comparação de dinheiro ----------
   0,1 + 0,2 não dá 0,3 em ponto flutuante. Comparar dois valores com > ou ===
   faz o app inventar um calote de R$ 0,000000000000004 e travar o fechamento
   do dia. Meio centavo é a margem: abaixo disso não existe dinheiro. */

/** true quando a diferença é menor que meio centavo */
export const mesmoValor = (a: number, b: number) => Math.abs((a || 0) - (b || 0)) < 0.005;

/** a diferença que sobra, já zerada quando é só poeira de ponto flutuante */
export function sobra(a: number, b: number): number {
  const d = (a || 0) - (b || 0);
  return Math.abs(d) < 0.005 ? 0 : d;
}

/** o que faltou receber (nunca negativo, nunca poeira) */
export const faltou = (devido: number, recebido: number) => Math.max(0, sobra(devido, recebido));

/** arredonda pro centavo — use antes de gravar qualquer valor no banco */
export const emCentavos = (n: number) => Math.round((n || 0) * 100) / 100;
