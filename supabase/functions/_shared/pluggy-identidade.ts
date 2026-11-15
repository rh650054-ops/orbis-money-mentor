// Vant — the provider's own reference of a bank entry (pure: shared by the edge functions and vitest).
//
// 15/11/2026 — what production showed, with the importer in "observar" for two days:
//   - Mercado Pago (personal accounts) re-issued Pluggy ids 29 times in 7 connections. All 497
//     old ids asked of Pluggy answered 404.
//   - Every transaction of those accounts carries a `providerCode`, one distinct value each.
//     In the 8 re-issues where the same set of transactions came back (137 transactions,
//     5 connections) the set of `providerCode` was identical before and after, while every
//     Pluggy id changed. No case to the contrary.
//   - Mercado Pago business accounts carry `providerId` instead (one distinct value each) and
//     were never seen re-issuing an id.
// So for this bank the payment has an identity of its own, and it is not Pluggy's id.
//
// What is still NOT known, and therefore not assumed:
//   - whether a reference can repeat on another day or with another amount. The identity used
//     here is reference + account + day + amount, all four. Same reference with another day or
//     amount is counted as "divergente" and nothing is merged.
//   - anything about other banks. Only a bank listed in bancoComReferencia gets a reference.

export type ModoDaIdentidade = "observar" | "aplicar";
/** "aplicar": a re-issued id is pointed back to the entry already stored. "observar": only counted. */
export const MODO_DA_IDENTIDADE: ModoDaIdentidade = "aplicar";

/** Banks whose reference was proven, in production, to survive a re-issue. */
export function bancoComReferencia(instituicao: string | null | undefined): boolean {
  return /mercado\s*pago/i.test(instituicao ?? "");
}

const preenchido = (v: unknown): v is string | number => (typeof v === "string" && v.trim() !== "") || typeof v === "number";

/** The provider's reference of one transaction, with the field it came from; null when it sends none. */
export function referenciaDe(t: { providerCode?: unknown; providerId?: unknown } | null | undefined): string | null {
  if (preenchido(t?.providerCode)) return `code:${String(t?.providerCode).trim()}`;
  if (preenchido(t?.providerId)) return `id:${String(t?.providerId).trim()}`;
  return null;
}

/** Pluggy id → reference, for one account's returned transactions. A reference that appears on
 *  two transactions of the same read identifies neither: those are left without one. */
export function referenciasDaLeitura(txs: { id?: unknown; providerCode?: unknown; providerId?: unknown }[]): { porId: Map<string, string>; repetidas: number } {
  const vezes = new Map<string, number>();
  for (const t of txs) { const r = referenciaDe(t); if (r) vezes.set(r, (vezes.get(r) ?? 0) + 1); }
  const porId = new Map<string, string>();
  let repetidas = 0;
  for (const t of txs) {
    const r = referenciaDe(t);
    if (!r || !t?.id) continue;
    if ((vezes.get(r) ?? 0) > 1) { repetidas++; continue; }
    porId.set(String(t.id), r);
  }
  return { porId, repetidas };
}

export interface ComIdentidade {
  transaction_id: string; conta_id?: string | null; provedor_ref?: string | null;
  transaction_date: string; amount: number | string; ids_anteriores?: string[] | null;
}
export interface Reapontamento { de: string; para: string; anteriores: string[] }

/** Returned entries whose Pluggy id is not stored, against stored entries with the same reference:
 *   - same account, day and amount under another id → the SAME payment re-issued: `reapontar`
 *     (the stored row takes the new id and remembers the old one);
 *   - same reference but another day or amount → `divergentes`: not merged, to be looked at.
 *  `vistos` = every id Pluggy returned: a stored id that came back is itself, never a twin. */
export function reapontamentos(novas: ComIdentidade[], guardadas: ComIdentidade[], vistos: Set<string>): { reapontar: Reapontamento[]; divergentes: string[] } {
  const chave = (e: ComIdentidade) => `${e.conta_id ?? ""}|${e.provedor_ref ?? ""}`;
  const porRef = new Map<string, ComIdentidade[]>();
  for (const g of guardadas) {
    if (!g.provedor_ref || !g.conta_id || vistos.has(g.transaction_id)) continue;
    porRef.set(chave(g), [...(porRef.get(chave(g)) ?? []), g]);
  }
  const reapontar: Reapontamento[] = [];
  const divergentes: string[] = [];
  for (const n of novas) {
    if (!n.provedor_ref || !n.conta_id) continue;
    const candidatas = porRef.get(chave(n)) ?? [];
    if (candidatas.length === 0) continue;
    const igual = candidatas.findIndex((g) => String(g.transaction_date).slice(0, 10) === n.transaction_date && Number(g.amount) === Number(n.amount));
    if (igual < 0) { divergentes.push(n.transaction_id); continue; }
    const g = candidatas.splice(igual, 1)[0];
    if (g) reapontar.push({ de: g.transaction_id, para: n.transaction_id, anteriores: [...(g.ids_anteriores ?? []), g.transaction_id] });
  }
  return { reapontar, divergentes };
}
