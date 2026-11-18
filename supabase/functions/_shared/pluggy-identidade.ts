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
/** One mode per kind of reference (15/11, owner's review):
 *   code (providerCode, Mercado Pago personal accounts) — its stability WAS observed: "aplicar";
 *   id   (providerId, Mercado Pago business accounts)   — never seen through a re-issue: "observar",
 *        i.e. stored and counted, while everything is written exactly as before.
 *  16/11 (owner's decision): the mode is decided PER TRANSACTION, by the kind of reference that
 *  transaction carries, inside its own account. One transaction with a providerCode says nothing
 *  about the others of the same connection. */
export interface ModosDaIdentidade {
  code: ModoDaIdentidade; id: ModoDaIdentidade;
  /** false = phase 1: the columns are used when they exist, and their absence means "migration not
   *  applied" (behaviour before it). true = phase 2, set once the objects were verified in
   *  production: from then on the columns MUST be there, and not finding them is a failure like any
   *  other — the read writes nothing and gets no stamp, instead of quietly losing the protection. */
  exigida?: boolean;
}
export const MODOS_DA_IDENTIDADE: ModosDaIdentidade = { code: "aplicar", id: "observar", exigida: false };
export const referenciaDeCodigo = (ref: string | null | undefined) => !!ref && ref.startsWith("code:");
export function modoDaReferencia(ref: string | null | undefined, modos: ModosDaIdentidade = MODOS_DA_IDENTIDADE): ModoDaIdentidade {
  return referenciaDeCodigo(ref) ? modos.code : modos.id;
}

/** Whether the identity columns can be used. A missing column means the migration was not applied
 *  (the importer then behaves as before it). ANY other failure — timeout, network, permission —
 *  is "indisponivel": the protection may exist, so nothing may be written or stamped without it. */
export type EstadoDaIdentidade = "ativa" | "sem_migration" | "indisponivel";
export function estadoPeloErro(erro: { code?: unknown; message?: unknown } | null | undefined, exigida = false): EstadoDaIdentidade {
  const semColuna = estadoSemExigir(erro);
  return exigida && semColuna === "sem_migration" ? "indisponivel" : semColuna;
}
function estadoSemExigir(erro: { code?: unknown; message?: unknown } | null | undefined): EstadoDaIdentidade {
  if (!erro) return "ativa";
  const codigo = String(erro.code ?? "");
  const texto = String(erro.message ?? "");
  if (codigo === "42703" || codigo === "PGRST204" || /column .* does not exist|could not find the .* column/i.test(texto)) return "sem_migration";
  return "indisponivel";
}

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

/** Pluggy id → reference, for one account's returned transactions.
 *  The identity is reference + day + amount (`chaveDe` gives day|amount): when two transactions of
 *  the same read share all three, the reference identifies neither and both are left without one.
 *  The same reference on another day or with another amount is a different identity. */
export function referenciasDaLeitura(
  txs: { id?: unknown; providerCode?: unknown; providerId?: unknown }[],
  chaveDe: (t: { id?: unknown }) => string = () => "",
): { porId: Map<string, string>; repetidas: number } {
  const k = (t: { id?: unknown; providerCode?: unknown; providerId?: unknown }) => { const r = referenciaDe(t); return r ? `${r}|${chaveDe(t)}` : null; };
  const vezes = new Map<string, number>();
  for (const t of txs) { const c = k(t); if (c) vezes.set(c, (vezes.get(c) ?? 0) + 1); }
  const porId = new Map<string, string>();
  let repetidas = 0;
  for (const t of txs) {
    const r = referenciaDe(t); const c = k(t);
    if (!r || !c || !t?.id) continue;
    if ((vezes.get(c) ?? 0) > 1) { repetidas++; continue; }
    porId.set(String(t.id), r);
  }
  return { porId, repetidas };
}

export interface ComIdentidade {
  transaction_id: string; conta_id?: string | null; provedor_ref?: string | null;
  transaction_date: string; amount: number | string; ids_anteriores?: string[] | null;
}
export interface Reapontamento { de: string; para: string; anteriores: string[] }
export interface Divergencia { novo: ComIdentidade; guardado: ComIdentidade }

/** Returned entries whose Pluggy id is not stored, against stored entries with the same reference
 *  in the same account:
 *   - same day and amount under another id → the SAME payment re-issued: `reapontar`
 *     (the stored row takes the new id and remembers the old one);
 *   - another day or amount → `divergentes`: the provider now shows that reference differently.
 *     It is neither assumed to be the same payment corrected nor a new one: the caller records it
 *     and does NOT add it to the money.
 *  `vistos` = every id Pluggy returned in the WHOLE read: a stored id that came back is itself,
 *  never a twin.
 *  `dataDe` = first day of the window that was read. A stored entry of an earlier day was not
 *  asked for, so its absence means nothing and it is never a candidate. */
export function reapontamentos(novas: ComIdentidade[], guardadas: ComIdentidade[], vistos: Set<string>, dataDe = ""): { reapontar: Reapontamento[]; divergentes: Divergencia[] } {
  const chave = (e: ComIdentidade) => `${e.conta_id ?? ""}|${e.provedor_ref ?? ""}`;
  const porRef = new Map<string, ComIdentidade[]>();
  for (const g of guardadas) {
    if (!g.provedor_ref || !g.conta_id || vistos.has(g.transaction_id)) continue;
    if (String(g.transaction_date).slice(0, 10) < dataDe) continue;
    porRef.set(chave(g), [...(porRef.get(chave(g)) ?? []), g]);
  }
  const reapontar: Reapontamento[] = [];
  const divergentes: Divergencia[] = [];
  for (const n of novas) {
    if (!n.provedor_ref || !n.conta_id) continue;
    const candidatas = porRef.get(chave(n)) ?? [];
    if (candidatas.length === 0) continue;
    const igual = candidatas.findIndex((g) => String(g.transaction_date).slice(0, 10) === n.transaction_date && Number(g.amount) === Number(n.amount));
    if (igual < 0) { const g = candidatas[0]; if (g) divergentes.push({ novo: n, guardado: g }); continue; }
    const g = candidatas.splice(igual, 1)[0];
    if (g) reapontar.push({ de: g.transaction_id, para: n.transaction_id, anteriores: [...(g.ids_anteriores ?? []), g.transaction_id] });
  }
  return { reapontar, divergentes };
}

// 17/11/2026 — what the first night in production showed (6 connections checked against Pluggy's
// statement, 13 to 17/11): Pluggy does not only give an old payment a new id. It also hands an id
// that it had given to ONE payment to ANOTHER one of the same amount. Ten cases in 24 hours:
//   - three Pix received on 16/11 (17:18, 18:38, 18:44) were stored under ids that, at 22:35, came
//     back as three payments of 13/11. The importer trusted the id and rewrote the three rows as
//     13/11 — where those payments were already stored: R$ 80 counted twice;
//   - the ids of three Pix of 13/11 came back, on 17/11, as payments of 16 and 17/11. 13/11 was no
//     longer read, so those three payments were gone from Vant: R$ 33 missing (Pluggy lists 6, Vant 3).
// In every case the `providerCode` that came with the id was ANOTHER one: the reference followed
// the payment, the id did not. So, where both carry a providerCode, two different references under
// one id are two payments — the stored one is kept and the one that arrived is treated as new.

/** The id of a stored entry whose Pluggy id was handed to another payment. Never a Pluggy id. */
export const PREFIXO_SEM_ID = "vant-sem-id:";
export const idSemPluggy = (id: string | null | undefined) => !!id && id.startsWith(PREFIXO_SEM_ID);

/** Returned entries whose Pluggy id IS stored, in this connection, for an entry that is not them:
 *   - `soltar`: both carry a reference of an APPLIED kind (providerCode) and the references differ.
 *     The stored entry is another payment and must not be overwritten;
 *   - `observados`: the stored entry has no reference (or one of a kind only observed) and the id
 *     came back on another day or with another amount. Nothing identifies either payment: counted,
 *     and written exactly as before.
 *  Same id and same reference is the entry itself, whatever else changed. */
export function reaproveitados(
  listadas: ComIdentidade[], guardadasPorId: (ComIdentidade & { bank_connection_id?: string | null })[], conexaoId: string,
  modos: ModosDaIdentidade = MODOS_DA_IDENTIDADE,
): { soltar: ComIdentidade[]; observados: number } {
  const aplicada = (ref: string | null | undefined) => !!ref && modoDaReferencia(ref, modos) === "aplicar";
  const porId = new Map<string, ComIdentidade>();
  for (const g of guardadasPorId) if (String(g.bank_connection_id ?? "") === conexaoId) porId.set(g.transaction_id, g);
  const soltar: ComIdentidade[] = [];
  let observados = 0;
  for (const l of listadas) {
    const g = porId.get(l.transaction_id);
    if (!g || !l.provedor_ref || g.provedor_ref === l.provedor_ref) continue;
    if (aplicada(l.provedor_ref) && aplicada(g.provedor_ref)) { soltar.push(g); continue; }
    const mudou = String(g.transaction_date).slice(0, 10) !== l.transaction_date || Number(g.amount) !== Number(l.amount);
    if (mudou) observados++;
  }
  return { soltar, observados };
}

/** The id a stored entry takes when Pluggy's id is no longer its own. It depends only on what
 *  identifies the payment (connection, account, reference, day, amount), so two imports at the same
 *  time — or a second try after a half-done one — arrive at the same id. */
export async function idDaPreservada(conexaoId: string, g: ComIdentidade): Promise<string> {
  const chave = [conexaoId, g.conta_id ?? "", g.provedor_ref ?? "", String(g.transaction_date).slice(0, 10), Number(g.amount).toFixed(2)].join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(chave));
  return PREFIXO_SEM_ID + [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}
