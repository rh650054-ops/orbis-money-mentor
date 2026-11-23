/** 2 → "2", 0.5 → "0,5" (pt-BR, at most 2 decimals). */
export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
