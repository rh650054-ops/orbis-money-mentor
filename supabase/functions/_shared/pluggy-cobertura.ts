// F-02 (audit 10/11/2026) — "bank read" must mean "the bank's data is complete up to here".
//
// leitura_ok_em is what lets the reconciliation write calote and the ranking mark a day as
// checked by the bank: a day counts as checked when leitura_ok_em is past its midnight. Until
// now it was stamped with the time WE read Pluggy. But Pluggy answers from its own copy: if it
// last synced with the bank at 08:57 (item OUTDATED, budget spent, bank offline), a read at
// 16:30 returns the same entries and was stamped 16:30. Every Pix after 08:57 became calote.
//
// The stamp is now the last time Pluggy really synced TRANSACTIONS with the bank. Rules, all
// conservative (when in doubt the column is left alone and the day stays unchecked):
//   1. only an item UPDATED;
//   2. Pluggy's per-product detail for transactions, when sent, is the only source: its own date
//      or nothing — never the item's general date (transactions may have stayed behind);
//   3. without that detail, the item's date counts only for a full SUCCESS;
//   4. the item must say the SAME thing before and after we read the transactions (a sync that
//      lands in the middle of our read is not stamped: we may not have imported all of it);
//   5. only after a complete read, never later than now, never backwards.
// deno-lint-ignore-file no-explicit-any

export type ItemPluggy = {
  status?: string | null;
  executionStatus?: string | null;
  lastUpdatedAt?: string | null;
  statusDetail?: { transactions?: { isUpdated?: boolean | null; lastUpdatedAt?: string | null } | null } | null;
};

const dataValida = (v: unknown): number => {
  const t = typeof v === "string" && v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : NaN;
};

/** Until when Pluggy's copy of this bank's transactions is known to be complete; null = unknown. */
export function coberturaDoItem(item: ItemPluggy | null | undefined, agora: Date = new Date()): Date | null {
  if (!item || String(item.status ?? "").toUpperCase() !== "UPDATED") return null;
  const tx = item.statusDetail?.transactions;
  let t = NaN;
  if (tx && typeof tx === "object") {
    t = dataValida(tx.lastUpdatedAt); // rule 2: its own date or nothing
  } else if (String(item.executionStatus ?? "").toUpperCase() === "SUCCESS") {
    t = dataValida(item.lastUpdatedAt); // rule 3
  }
  if (!Number.isFinite(t)) return null;
  return new Date(Math.min(t, agora.getTime()));
}

/** Value to store in leitura_ok_em after a read, or null to leave the column as it is.
 *  `antes` = the item fetched BEFORE reading the transactions, `depois` = fetched AFTER. */
export function carimboDeLeitura(p: {
  completa: boolean; antes: ItemPluggy | null | undefined; depois: ItemPluggy | null | undefined;
  atual: string | null | undefined; agora?: Date;
}): string | null {
  if (!p.completa) return null; // we did not even read everything Pluggy has
  const agora = p.agora ?? new Date();
  const a = coberturaDoItem(p.antes, agora);
  const d = coberturaDoItem(p.depois, agora);
  if (!a || !d || a.getTime() !== d.getTime()) return null; // rule 4: Pluggy moved while we were reading
  const atual = dataValida(p.atual ?? null);
  if (Number.isFinite(atual) && atual >= a.getTime()) return null; // forward only
  return a.toISOString();
}

/** Reads the transactions between two looks at the item and decides the stamp.
 *  The second look only happens when a stamp is still possible (one Pluggy call saved otherwise). */
export async function importarComCarimbo<R extends { completa: boolean }>(p: {
  buscar: () => Promise<ItemPluggy | null>;
  importar: () => Promise<R>;
  atual: string | null | undefined;
  antes?: ItemPluggy | null; // the caller already has the item (webhook, first connection)
  rotulo?: string;
}): Promise<{ r: R; carimbo: string | null }> {
  const antes = p.antes !== undefined ? p.antes : await p.buscar();
  const r = await p.importar();
  let carimbo: string | null = null;
  let depois: ItemPluggy | null | undefined;
  if (r.completa && carimboDeLeitura({ completa: true, antes, depois: antes, atual: p.atual })) {
    depois = await p.buscar();
    carimbo = carimboDeLeitura({ completa: true, antes, depois, atual: p.atual });
  }
  // no personal data: only what Pluggy says about the sync, to audit the stamp
  console.log("pluggy cobertura", JSON.stringify({
    conexao: p.rotulo ?? null, completa: r.completa, carimbo, antes: resumo(antes), depois: depois === undefined ? "nao_consultado" : resumo(depois),
  }));
  return { r, carimbo };
}

const resumo = (i: ItemPluggy | null | undefined) => i ? {
  status: i.status ?? null, exec: i.executionStatus ?? null, item: i.lastUpdatedAt ?? null,
  tx: i.statusDetail?.transactions ? { ok: i.statusDetail.transactions.isUpdated ?? null, em: i.statusDetail.transactions.lastUpdatedAt ?? null } : null,
} : null;

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
