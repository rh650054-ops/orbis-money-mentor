// 09/11/2026 (Rick): "bloqueie da pessoa conectar o mesmo banco duas vezes, e lembrando quem tem
// o Pro mensal usa só um banco".
//
// The connect-token already refuses to open the widget past the plan's limit (open_finance_limite:
// Pro monthly 1 bank, annual 2, + paid extra banks). But one widget session can still create SEVERAL
// items (Mercado Pago OAuth loop: 4 items in 34 s on 09/11), and the webhook's auto-heal created a
// connection for each one, with no limit and no bank check. Each copy imported the same week again.
//
// Two rules, applied wherever a connection is created (pluggy-item and the webhook's auto-heal):
//   1. one connection per bank per seller: connecting the same bank again REPLACES the old one
//      (the newest stays, so reconnecting a broken bank still works);
//   2. a different bank only fits while the seller is under the plan's limit; otherwise the
//      new Pluggy item is deleted and no connection is created.
// deno-lint-ignore-file no-explicit-any

export type Ativa = { id: string; item_id: string | null; institution_name: string | null; created_at: string };

const chaveBanco = (nome: string | null) => String(nome ?? "").trim().toLowerCase();

/** Pure: ids to drop so each bank keeps only its newest connection. */
export function repetidasDoMesmoBanco(ativas: Ativa[]): string[] {
  const grupos = new Map<string, Ativa[]>();
  for (const a of ativas) {
    const k = chaveBanco(a.institution_name);
    if (!k) continue;
    grupos.set(k, [...(grupos.get(k) ?? []), a]);
  }
  const fora: string[] = [];
  for (const g of grupos.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || (a.id < b.id ? 1 : -1));
    fora.push(...g.slice(1).map((a) => a.id));
  }
  return fora;
}

/** Pure: does a connection to `banco` (item `itemId`) fit in the plan? Same bank never counts
 *  against the limit (it replaces the old one). `limite` null = exempt. */
export function cabeNoPlano(ativas: Ativa[], banco: string | null, itemId: string, limite: number | null): boolean {
  if (limite === null) return true;
  const k = chaveBanco(banco);
  const outros = new Set(ativas.filter((a) => a.item_id !== itemId && chaveBanco(a.institution_name) !== k)
    .map((a) => chaveBanco(a.institution_name)));
  return outros.size < limite;
}

export async function apagarItemNaPluggy(apiKey: string, itemId: string): Promise<boolean> {
  const r = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE", headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  return !!r && (r.ok || r.status === 404);
}

async function ativasDo(admin: any, userId: string): Promise<Ativa[]> {
  const { data } = await admin.from("bank_connections")
    .select("id, item_id, institution_name, created_at").eq("user_id", userId).neq("status", "deleted");
  return (data ?? []) as Ativa[];
}

/** Before creating a connection: true when it fits the plan. On false the caller must not create it. */
export async function vagaParaBanco(admin: any, userId: string, banco: string | null, itemId: string): Promise<boolean> {
  const { data: lim, error } = await admin.rpc("open_finance_limite", { p_user: userId });
  if (error || !lim) return true; // never block on a failed check: the hourly cleanup still runs
  const limite = lim.isento ? null : Number(lim.limite ?? 0);
  return cabeNoPlano(await ativasDo(admin, userId), banco, itemId, limite);
}

/** After creating a connection: the older connections of the same bank go (Pluggy item + row). */
export async function umPorBanco(admin: any, apiKey: string, userId: string): Promise<number> {
  const ativas = await ativasDo(admin, userId);
  const fora = repetidasDoMesmoBanco(ativas);
  let n = 0;
  for (const id of fora) {
    const c = ativas.find((a) => a.id === id);
    if (!c) continue;
    if (c.item_id && !(await apagarItemNaPluggy(apiKey, c.item_id))) continue; // try again next time
    const { error } = await admin.from("bank_connections")
      .update({ status: "deleted", updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) n++;
  }
  if (n > 0) console.log("pluggy: mesmo banco, conexao antiga trocada pela nova", userId, n);
  return n;
}
