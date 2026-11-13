// Vant — the oldest day of a read window (pure: shared by the edge functions and vitest).
//
// 13/11/2026 — what production showed: one Mercado Pago day stored twice inside ONE connection
// (28 entries / R$ 554.99 became 56 / R$ 1,109.98; the doubled total reached the ranking as
// "verified by the bank"). Pluggy re-creates Mercado Pago transactions under new ids when a
// refresh we asked for ends, and sends no transactions/deleted. On the window's oldest day nothing
// is ever removed (Pluggy filters in UTC), yet every returned id was inserted.
//
// 13/11 (owner's review): "same day and same amount" is NOT proof of a duplicate. The same review
// found that 7 entries first counted as copies were 7 distinct releases of money, each with its
// own time. So nothing here is decided by day+amount:
//
//   1. IDENTITY. Pluggy's id is not stable for Mercado Pago, and what the Vant stores has no other
//      id. The comparison uses EVERY attribute stored (impressao): day, amount, description, Pix
//      or not, exact instant, payer name and document. Two payments of the same amount from
//      different payers, or at different times, are different and are never paired.
//   2. A returned id that is not stored yet can only be a re-issue when a stored entry with the
//      very same attributes is MISSING from what Pluggy returned (parearComSumidas). With no such
//      entry it is a payment: LEGITIMA.
//   3. When there is one, nothing is concluded from the comparison. Pluggy is asked about the OLD
//      id (vereditoDoPar):
//        - it no longer exists  → Pluggy replaced it: DUPLICADA, the new id is not stored;
//        - it still exists      → Pluggy holds two transactions: LEGITIMA, the new id is stored;
//        - no answer            → A_CONFERIR: not stored now, the read is NOT stamped as proven,
//                                 and the next read asks again.
//
// Nothing is removed on that day, with any verdict.

export interface EntradaDaMargem {
  transaction_id: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  transacted_at: string | null;
  is_pix: boolean;
  pagador_nome?: string | null;
  pagador_doc?: string | null;
}

export type Veredito = "legitima" | "duplicada" | "a_conferir";
/** What Pluggy says about one transaction id. */
export type Existe = "existe" | "nao_existe" | "sem_resposta";
export interface Par { nova: string; antiga: string }

const instante = (v: string | null | undefined): string => {
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? String(t) : "";
};
const texto = (v: string | null | undefined) => String(v ?? "").trim().toLowerCase();

/** Every attribute the Vant stores about an entry, as one comparable value. */
export function impressao(e: EntradaDaMargem): string {
  return [
    String(e.transaction_date).slice(0, 10), Number(e.amount).toFixed(2), texto(e.description), e.is_pix ? "pix" : "-",
    instante(e.transacted_at), texto(e.pagador_doc), texto(e.pagador_nome),
  ].join("|");
}

/** A stored entry of the oldest day that Pluggy could have returned in this read.
 *  Pluggy was asked for `dateFrom = dataDe` in UTC. A bank that stamps its credits N hours early
 *  (horasAtrasoDoBanco) has the first hours of the day BEFORE that instant: such an entry is not
 *  expected back, so its absence says nothing and it is never taken for a twin. */
export function contaNaMargem(g: { transacted_at: string | null }, dataDe: string, horasAtraso: number): boolean {
  if (!g.transacted_at) return true; // date-only entry: its date is the asked day
  const guardado = Date.parse(g.transacted_at);
  if (Number.isNaN(guardado)) return true;
  return guardado - horasAtraso * 3_600_000 >= Date.parse(`${dataDe}T00:00:00Z`);
}

/** Splits the returned entries that are not stored yet:
 *   - `legitimas`: no stored entry with the same attributes is missing from this read;
 *   - `pares`: one is missing — each new id is tied to ONE missing stored id, to be asked of Pluggy.
 *  `vistos` = every id Pluggy returned in this read. */
export function parearComSumidas(
  novas: EntradaDaMargem[], guardadas: EntradaDaMargem[], vistos: Set<string>, dataDe: string, horasAtraso: number,
): { legitimas: string[]; pares: Par[] } {
  const sumidas = new Map<string, string[]>();
  for (const g of [...guardadas].sort((a, b) => a.transaction_id.localeCompare(b.transaction_id))) {
    if (vistos.has(g.transaction_id)) continue;       // it came back: it is itself, not a twin
    if (!contaNaMargem(g, dataDe, horasAtraso)) continue; // it was not asked for
    const k = impressao(g);
    sumidas.set(k, [...(sumidas.get(k) ?? []), g.transaction_id]);
  }
  const legitimas: string[] = [];
  const pares: Par[] = [];
  for (const n of novas) {
    const antiga = sumidas.get(impressao(n))?.shift();
    if (antiga) pares.push({ nova: n.transaction_id, antiga }); else legitimas.push(n.transaction_id);
  }
  return { legitimas, pares };
}

/** The verdict on a new id, from what Pluggy says about the old id it was tied to. */
export function vereditoDoPar(antiga: Existe): Veredito {
  if (antiga === "nao_existe") return "duplicada";
  if (antiga === "existe") return "legitima";
  return "a_conferir";
}
