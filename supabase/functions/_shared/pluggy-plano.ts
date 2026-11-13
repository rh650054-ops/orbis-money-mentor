// Vant — "does this seller have an active plan?" as a question that may go unanswered
// (pure: shared by the edge functions and vitest).
//
// 13/11/2026: pluggy-item and the webhook's auto-cura read `rpc("orbis_pro_ativo").data === true`.
// When the database did not answer (timeout, 5xx), `data` is null and the seller was treated as
// having NO plan: a subscriber who had just authorised the bank got "precisa_pro". A failed query
// is not an answer (same rule as the slot check and the connect token).

export type Plano = "sim" | "nao" | "indisponivel";

/** What the RPC said: true / false, or undefined when it did not answer. */
export function respostaDoPlano(r: { data?: unknown; error?: unknown } | null | undefined): boolean | undefined {
  if (!r || r.error) return undefined;
  if (r.data === true) return true;
  if (r.data === false) return false;
  return undefined;
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Asks; with no answer, once more after a short wait. Still no answer = "indisponivel". */
export async function planoAtivo(perguntar: () => Promise<boolean | undefined>, esperaMs = 300): Promise<Plano> {
  let r = await perguntar().catch(() => undefined);
  if (r === undefined) {
    if (esperaMs > 0) await esperar(esperaMs);
    r = await perguntar().catch(() => undefined);
  }
  return r === undefined ? "indisponivel" : r ? "sim" : "nao";
}
