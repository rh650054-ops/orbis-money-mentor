/* ============================================================
   VENDIDO DO DIA (Rick, 18/10/2026).
   Em daily_sales, total_profit é o que CAIU (dinheiro + Pix + cartão) e total_debt é
   o que FALTOU cair. Vendido é a soma. Desde que o banco confere o dia
   (banco_reconciliar), total_profit virou só o que o banco mostrou — e todo lugar
   que lia total_profit como "faturamento" passou a mostrar menos do que foi vendido
   (16/10: vendeu 305, relatório mostrava 132). Todo mundo lê daqui agora.
   ============================================================ */
export interface LinhaVendida {
  total_profit?: number | string | null;
  total_debt?: number | string | null;
}

/** O que foi vendido no dia: caiu + faltou cair. */
export const vendidoDoDia = (d: LinhaVendida | null | undefined): number =>
  Math.round(((Number(d?.total_profit) || 0) + (Number(d?.total_debt) || 0)) * 100) / 100;

/** Soma do vendido de várias linhas. */
export const vendidoTotal = (linhas: readonly (LinhaVendida | null | undefined)[] | null | undefined): number =>
  Math.round((linhas ?? []).reduce((s, d) => s + vendidoDoDia(d), 0) * 100) / 100;
