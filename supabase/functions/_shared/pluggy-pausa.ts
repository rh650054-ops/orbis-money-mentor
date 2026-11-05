// 04/11/2026 (Rick): lost access → the bank stops being read (bank_connections.pausado_em, set hourly
// by banco_pausar_sem_acesso); after 7 days paused, the Pluggy item is removed.
export const DIAS_PAUSADA = 7;

/** Connections paused long enough to be removed on Pluggy. */
export function pausadasParaDesligar<T extends { pausado_em: string | null }>(conexoes: T[], agora: Date, dias = DIAS_PAUSADA): T[] {
  const limite = agora.getTime() - dias * 86_400_000;
  return conexoes.filter((c) => !!c.pausado_em && Date.parse(c.pausado_em) <= limite);
}

/** Removes the Pluggy item of connections paused for 7+ days and marks them deleted. */
// deno-lint-ignore no-explicit-any
export async function desligarPausadas(admin: any, chave: () => Promise<string | null>, agora = new Date()): Promise<number> {
  const { data } = await admin.from("bank_connections")
    .select("id, item_id, pausado_em").neq("status", "deleted").not("pausado_em", "is", null);
  const fora = pausadasParaDesligar((data ?? []) as { id: string; item_id: string | null; pausado_em: string | null }[], agora);
  if (fora.length === 0) return 0;
  const apiKey = await chave();
  if (!apiKey) return 0;
  let n = 0;
  for (const c of fora) {
    if (c.item_id) {
      const r = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(c.item_id)}`, {
        method: "DELETE", headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      if (!r || (!r.ok && r.status !== 404)) continue; // try again next run
    }
    const { error } = await admin.from("bank_connections")
      .update({ status: "deleted", updated_at: new Date().toISOString() }).eq("id", c.id);
    if (!error) n++;
  }
  return n;
}
