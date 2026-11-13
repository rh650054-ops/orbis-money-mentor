// Vant — the oldest day of a read window (pure: shared by the edge functions and vitest).
//
// 13/11/2026: production showed the same Mercado Pago day stored twice inside ONE connection
// (28 entries / R$ 554.99 became 56 / R$ 1,109.98, and that total went to the ranking as
// "verified by the bank"). Cause: Pluggy re-creates Mercado Pago transactions with new ids when a
// refresh we asked for ends, and sends no transactions/deleted for them. On every other day of the
// window the old twin is dropped (idsSubstituidos). On the window's OLDEST day nothing is ever
// dropped — Pluggy filters in UTC, so part of that day may be outside what was asked — but the
// re-issued twin was still inserted. Result: one extra copy of that day, every time.
//
// Rule here: on the oldest day nothing is removed (as before) and a returned id that is not stored
// yet is written only while that day+amount still has fewer stored entries than Pluggy returned.

export interface NovaDaMargem { transaction_id: string; chave: string }
export interface GuardadaDaMargem { chave: string; transacted_at: string | null }

/** A stored entry of the oldest day that Pluggy could have returned in this read.
 *  Pluggy was asked for `dateFrom = dataDe` in UTC. A bank that stamps its credits N hours early
 *  (horasAtrasoDoBanco) has the first hours of the day BEFORE that instant: those entries are
 *  not expected back, so they must not stand in the place of a returned one. */
export function contaNaMargem(g: { transacted_at: string | null }, dataDe: string, horasAtraso: number): boolean {
  if (!g.transacted_at) return true; // date-only entry: its date is the asked day
  const guardado = Date.parse(g.transacted_at);
  if (Number.isNaN(guardado)) return true;
  return guardado - horasAtraso * 3_600_000 >= Date.parse(`${dataDe}T00:00:00Z`);
}

/** How many stored entries of the oldest day, per day+amount, Pluggy could have returned. */
export function guardadasPorChave(guardadas: GuardadaDaMargem[], dataDe: string, horasAtraso: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const g of guardadas) {
    if (!contaNaMargem(g, dataDe, horasAtraso)) continue;
    out.set(g.chave, (out.get(g.chave) ?? 0) + 1);
  }
  return out;
}

/** Ids, among the returned entries of the oldest day that are not stored yet, that may be written:
 *  per day+amount, only as many as Pluggy returned beyond what is already stored.
 *    - ids re-issued (same count, new ids)      → none is written, the day keeps its total
 *    - one really new entry among stable ids    → that one is written
 *    - nothing stored for that day+amount       → everything returned is written
 *    - Pluggy returned fewer than stored        → none is written, nothing is removed */
export function novasQueCabem(
  novas: NovaDaMargem[], guardadas: Map<string, number>, vistosPorChave: Map<string, number>,
): string[] {
  const cabem = new Map<string, number>();
  const out: string[] = [];
  for (const n of novas) {
    if (!cabem.has(n.chave)) {
      cabem.set(n.chave, Math.max((vistosPorChave.get(n.chave) ?? 0) - (guardadas.get(n.chave) ?? 0), 0));
    }
    const resta = cabem.get(n.chave) ?? 0;
    if (resta <= 0) continue;
    cabem.set(n.chave, resta - 1);
    out.push(n.transaction_id);
  }
  return out;
}
