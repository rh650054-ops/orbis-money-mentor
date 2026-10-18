/* "Sua atividade": three numbers from the last 30 days of Foco blocks. */
import type { Atividade } from "../types";

export interface BlocoFoco {
  started_at: string | null;
  created_at: string | null;
  sales_count: number | null;
  approaches_count: number | null;
  sold_amount: number | null;
}

const diaBR = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export function resumirAtividade(blocos: BlocoFoco[]): Atividade {
  const dias = new Set<string>();
  let vendas = 0, abordagens = 0, faturamento = 0;
  for (const b of blocos) {
    const v = Number(b.sales_count) || 0;
    vendas += v;
    abordagens += Number(b.approaches_count) || 0;
    faturamento += Number(b.sold_amount) || 0;
    const quando = b.started_at ?? b.created_at;
    if (quando && (v > 0 || (Number(b.sold_amount) || 0) > 0)) dias.add(diaBR(quando));
  }
  return { vendas, abordagens, diasAtivos: dias.size, faturamento };
}

/** Conversion only makes sense with approaches logged; otherwise null (hidden). */
export function conversao(a: Atividade): number | null {
  if (a.abordagens < 5) return null;
  return Math.min(100, Math.round((a.vendas / a.abordagens) * 100));
}
