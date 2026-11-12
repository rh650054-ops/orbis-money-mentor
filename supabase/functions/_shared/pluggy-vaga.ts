// 09/11/2026 (Rick): "bloqueie da pessoa conectar o mesmo banco duas vezes, e lembrando quem tem
// o Pro mensal usa só um banco".
//
// The connect-token already refuses to open the widget past the plan's limit (open_finance_limite:
// Pro monthly 1 bank, annual 2, + paid extra banks). But one widget session can still create SEVERAL
// items (Mercado Pago OAuth loop: 4 items in 34 s on 09/11), and the webhook's auto-heal created a
// connection for each one, with no limit and no bank check. Each copy imported the same week again.
//
// 09/11 answered with two rules: "same bank again REPLACES the old connection" and "a different
// bank only fits under the plan's limit".
//
// 12/11/2026 (Rick, A2): a limit that could not be read no longer lets a new connection in.
// The answer has three values: "cabe", "sem_vaga" (the limit is known and exceeded) and
// "indisponivel" (the limit or the seller's connections could not be read — a temporary failure).
// Only "sem_vaga" may delete the new Item on Pluggy; "indisponivel" creates nothing and deletes
// nothing. An Item that is already the seller's live connection always fits (reauthorisation).
//
// 12/11/2026 (Rick, A4): "contas distintas da mesma instituição não são automaticamente
// duplicadas. Não exclua conexões com base apenas no nome do banco." A personal and a business
// account at the same bank have the same institution name and are two accounts. So:
//   - nothing is deleted here any more because of the bank's name (umPorBanco is gone);
//   - every live connection takes a slot, same bank or not — the same count the database's
//     open_finance_limite and the connect token already use. That is also what stops one widget
//     session from leaving several Items behind: past the limit, the extra Item is refused;
//   - real copies of the SAME account are removed only with proof, by the robot
//     (pluggy-duplicadas.ts).
// deno-lint-ignore-file no-explicit-any

export type Ativa = { id: string; item_id: string | null; institution_name: string | null; created_at: string };

const chaveBanco = (nome: string | null) => String(nome ?? "").trim().toLowerCase();

/** Pure: the seller's other live connections at the same institution (for the log only). */
export function doMesmoBanco(ativas: Ativa[], banco: string | null, itemId: string): Ativa[] {
  const k = chaveBanco(banco);
  if (!k) return [];
  return ativas.filter((a) => a.item_id !== itemId && chaveBanco(a.institution_name) === k);
}

/** Pure: does one more connection (item `itemId`) fit in the plan? Every other live connection
 *  takes a slot, whatever its bank. `limite` null = exempt. */
export function cabeNoPlano(ativas: Ativa[], itemId: string, limite: number | null): boolean {
  if (limite === null) return true;
  return ativas.filter((a) => a.item_id !== itemId).length < limite;
}

export async function apagarItemNaPluggy(apiKey: string, itemId: string): Promise<boolean> {
  const r = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE", headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  return !!r && (r.ok || r.status === 404);
}

export type Vaga = "cabe" | "sem_vaga" | "indisponivel";

/** Pure: the plan's limit out of open_finance_limite's answer. null = exempt; undefined = cannot tell. */
export function limiteDoPlano(resposta: unknown): number | null | undefined {
  if (!resposta || typeof resposta !== "object" || Array.isArray(resposta)) return undefined;
  const r = resposta as { isento?: unknown; limite?: unknown };
  if (r.isento === true) return null;
  if (typeof r.limite !== "number" || !Number.isInteger(r.limite) || r.limite < 0) return undefined;
  return r.limite;
}

/** Pure: the decision. `ativas` null = the seller's connections could not be read. */
export function decidirVaga(p: { ativas: Ativa[] | null; limite: number | null | undefined; itemId: string }): Vaga {
  if (!p.ativas) return "indisponivel";
  if (p.ativas.some((a) => a.item_id === p.itemId)) return "cabe"; // already ours: takes no slot
  if (p.limite === undefined) return "indisponivel";
  return cabeNoPlano(p.ativas, p.itemId, p.limite) ? "cabe" : "sem_vaga";
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Runs a read; when it fails, once more after a short wait. undefined = failed twice. */
async function lerDuasVezes<T>(ler: () => Promise<T | undefined>, esperaMs: number): Promise<T | undefined> {
  const a = await ler().catch(() => undefined);
  if (a !== undefined) return a;
  if (esperaMs > 0) await esperar(esperaMs);
  return await ler().catch(() => undefined);
}

/** The seller's live connections; null when the database did not answer. */
async function ativasDo(admin: any, userId: string): Promise<Ativa[] | null> {
  const { data, error } = await admin.from("bank_connections")
    .select("id, item_id, institution_name, created_at").eq("user_id", userId).neq("status", "deleted");
  if (error || !Array.isArray(data)) return null;
  return data as Ativa[];
}

/** Before creating a connection. Anything but "cabe": the caller must not create it.
 *  Only on "sem_vaga" may the caller delete the new Item on Pluggy. */
export async function vagaParaBanco(
  admin: any, userId: string, banco: string | null, itemId: string, opcoes: { esperaMs?: number } = {},
): Promise<Vaga> {
  const esperaMs = opcoes.esperaMs ?? 300;
  const ativas = (await lerDuasVezes(async () => (await ativasDo(admin, userId)) ?? undefined, esperaMs)) ?? null;
  const semLimite = decidirVaga({ ativas, limite: undefined, itemId });
  if (semLimite === "cabe" || !ativas) {
    if (!ativas) console.error("pluggy vaga: conexoes ativas nao puderam ser lidas", userId);
    return semLimite; // already ours, or nothing can be said
  }
  // a limit that is absent is a failed read, never "zero banks allowed"
  const limite = await lerDuasVezes(async () => {
    const { data, error } = await admin.rpc("open_finance_limite", { p_user: userId });
    return error ? undefined : limiteDoPlano(data);
  }, esperaMs);
  if (limite === undefined) console.error("pluggy vaga: limite do plano nao pode ser lido", userId);
  const vaga = decidirVaga({ ativas, limite, itemId });
  // A4: same institution again is another connection — it takes a slot and nothing is deleted
  const iguais = doMesmoBanco(ativas, banco, itemId).length;
  if (iguais > 0) console.log("pluggy vaga: mesmo banco ja conectado, nada e apagado", JSON.stringify({ usuario: userId, outras: iguais, vaga }));
  return vaga;
}
