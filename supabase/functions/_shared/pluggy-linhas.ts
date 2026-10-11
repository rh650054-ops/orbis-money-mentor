// Vant — which bank entries really need writing (pure: shared by the edge functions and vitest).
// 08/10/2026: re-saving identical rows on every read was ~50 rewrites per new entry,
// each one also a realtime event — the biggest load on the database.

export interface LinhaEntrada {
  transaction_id: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  transacted_at: string | null;
  is_pix: boolean;
  own_transfer: boolean;
  /** quem pagou, como a Pluggy informa (11/10/2026: pra barrar Pix da própria conta e do pagador repetido) */
  pagador_nome?: string | null;
  pagador_doc?: string | null;
}

const mesmoInstante = (a: string | null | undefined, b: string | null | undefined) =>
  (a ? Date.parse(a) : null) === (b ? Date.parse(b) : null);

/** Rows that are new, or whose bank data differs from what is stored (status is never compared: it is the vendor's). */
export function linhasMudadas<T extends LinhaEntrada>(linhas: T[], existentes: Partial<LinhaEntrada>[]): T[] {
  const porId = new Map(existentes.map((e) => [String(e.transaction_id), e]));
  return linhas.filter((l) => {
    const e = porId.get(l.transaction_id);
    if (!e) return true;
    return Number(e.amount) !== l.amount ||
      (e.description ?? null) !== l.description ||
      String(e.transaction_date ?? "").slice(0, 10) !== l.transaction_date ||
      !mesmoInstante(e.transacted_at, l.transacted_at) ||
      !!e.is_pix !== l.is_pix ||
      !!e.own_transfer !== l.own_transfer ||
      (e.pagador_nome ?? null) !== (l.pagador_nome ?? null) ||
      (e.pagador_doc ?? null) !== (l.pagador_doc ?? null);
  });
}

