/**
 * Cash adjustment math (Rick, 01/11): typing cash means "part of what I sold was paid in
 * cash", not "I sold more". So "Vendeu" stays the same and the cash comes out of what was
 * launched as Pix/card (on today's row, Pix still holds what the seller launched; after the
 * midnight bank reconciliation it holds what the bank saw). Anything left becomes
 * "falta cair". "Vendeu" only grows when cash alone exceeds what was sold that day.
 */
export interface LinhaDia { cash: number; pix: number; card: number; caiu: number; debt: number }
export interface ContaDinheiro { cash: number; pix: number; card: number; caiu: number; debt: number; vendeu: number }

const r2 = (n: number) => Math.round(n * 100) / 100;

export function ajustarDinheiro(linha: LinhaDia, novoDinheiro: number): ContaDinheiro {
  const cash = Math.max(0, r2(novoDinheiro));
  const vendeuAntes = Math.max(0, linha.caiu) + Math.max(0, linha.debt);
  const vendeu = r2(Math.max(vendeuAntes, cash));
  const pix = r2(Math.min(Math.max(0, linha.pix), Math.max(0, vendeu - cash - Math.max(0, linha.card))));
  const card = r2(Math.min(Math.max(0, linha.card), Math.max(0, vendeu - cash - pix)));
  const caiu = r2(cash + pix + card);
  const debt = r2(Math.max(0, vendeu - caiu));
  return { cash, pix, card, caiu, debt, vendeu };
}
