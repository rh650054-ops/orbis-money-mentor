// F-02 (audit 10/11/2026) — "bank read" must mean "the bank's data is complete up to here".
//
// leitura_ok_em is what lets the reconciliation write calote and the ranking mark a day as
// checked by the bank: a day counts as checked when leitura_ok_em is past its midnight. Until
// now it was stamped with the time WE read Pluggy. But Pluggy answers from its own copy: if it
// last synced with the bank at 08:57 (item OUTDATED, budget spent, bank offline), a read at
// 16:30 returns the same entries and was stamped 16:30. Every Pix after 08:57 became calote.
//
// The stamp is now the last time Pluggy really synced TRANSACTIONS with the bank, and only for
// an item in good standing. It never moves backwards, so nothing already stored is rewritten.
// deno-lint-ignore-file no-explicit-any

export type ItemPluggy = {
  status?: string | null;
  lastUpdatedAt?: string | null;
  statusDetail?: { transactions?: { isUpdated?: boolean | null; lastUpdatedAt?: string | null } | null } | null;
};

/** Until when Pluggy's copy of this bank is known to be complete; null = unknown. */
export function coberturaDoItem(item: ItemPluggy | null | undefined, agora: Date = new Date()): Date | null {
  if (!item || String(item.status ?? "").toUpperCase() !== "UPDATED") return null;
  // PARTIAL_SUCCESS: the item is UPDATED but transactions may have stayed behind — their own date wins
  const bruto = item.statusDetail?.transactions?.lastUpdatedAt ?? item.lastUpdatedAt ?? null;
  const t = bruto ? Date.parse(String(bruto)) : NaN;
  if (!Number.isFinite(t)) return null;
  return new Date(Math.min(t, agora.getTime())); // a clock ahead of ours never reaches the future
}

/** Value to store in leitura_ok_em after a read, or null to leave the column as it is. */
export function carimboDeLeitura(p: { completa: boolean; item: ItemPluggy | null | undefined; atual: string | null | undefined; agora?: Date }): string | null {
  if (!p.completa) return null; // we did not even read everything Pluggy has
  const ate = coberturaDoItem(p.item, p.agora ?? new Date());
  if (!ate) return null;
  const atual = p.atual ? Date.parse(p.atual) : NaN;
  if (Number.isFinite(atual) && atual >= ate.getTime()) return null; // forward only
  return ate.toISOString();
}

/** The item as Pluggy has it now (status + last real sync). null when Pluggy does not answer. */
export async function buscarItem(apiKey: string, itemId: string): Promise<ItemPluggy | null> {
  try {
    const r = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(itemId)}`, {
      headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) { console.log("pluggy item", r.status, itemId); return null; }
    const corpo: any = await r.json().catch(() => null);
    return corpo && typeof corpo === "object" ? corpo as ItemPluggy : null;
  } catch (e) {
    console.log("pluggy item falhou", (e as Error)?.message);
    return null;
  }
}
