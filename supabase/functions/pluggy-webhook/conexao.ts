// A7 (12/11/2026) — what the webhook does with an event, given the connection it found for the
// Item. Kept apart from Deno so it can be tested.
//
// A removed connection never comes back on its own. Until now an event for an Item whose
// connection was REMOVED here, while Pluggy still returned the Item, wrote Pluggy's status over
// "deleted": the connection became active again, got the badge and had entries imported into it.
// That can happen when an event already on its way is processed right after the seller
// disconnects, or for connections marked removed without their Item having been deleted on Pluggy.
// The robot has had this rule since A5 (conferirEstado); only the seller connecting again in the
// app (pluggy-item, A2) brings a removed connection back.
//
// And a lookup that FAILS is not "there is no connection": it used to send the event down the
// path that creates one.

//
// A7, race (12/11): the lookup and the write are two moments. If the seller disconnects between
// them, a plain "update ... where id = X" still writes over "deleted". So every write to an
// existing connection carries the condition IN THE DATABASE ("and status <> 'deleted'"), and the
// connection is confirmed again right before the badge and the import. If it was removed while
// the event was being processed, the flow ends without bringing it back.

import { grupoDoStatus, statusParaGravar } from "../_shared/pluggy-estado.ts";

export type Trato =
  | "nao_consultada" // the lookup failed: the event is not handled at all
  | "criar" // no connection for this Item: the auto-cura decides whether to create one
  | "removida" // the connection was removed: nothing is written, granted or imported
  | "seguir"; // a live connection: state, badge and import as always

export function tratoDoEvento(p: { consultou: boolean; con: { status?: string | null } | null | undefined }): Trato {
  if (!p.consultou) return "nao_consultada";
  if (!p.con) return "criar";
  return grupoDoStatus(p.con.status) === "removido" ? "removida" : "seguir";
}

export type ItemDaConexao = {
  status?: string | null;
  executionStatus?: string | null;
  error?: { code?: string | null } | null;
  connector?: { name?: string | null; imageUrl?: string | null } | null;
};

/** What is written on an existing connection when an event arrives. */
export type CamposDoEstado = { status?: string; institution_name?: string; institution_logo?: string; updated_at: string };

export interface PortasDaConexao {
  /** Writes ONLY if the connection is not removed — the condition is part of the write itself.
   *  true = a row was written. false = it is removed (or the write could not be confirmed). */
  gravarSeViva(conId: string, campos: CamposDoEstado): Promise<boolean>;
  /** Is the connection there and not removed, right now? false also when that cannot be confirmed. */
  aindaViva(conId: string): Promise<boolean>;
}

/** Keeps the state of a live connection honest (A3) — never over a removal that happened after
 *  the lookup. With no Item from Pluggy there is nothing to write, but the connection is still
 *  confirmed. "removida" = stop: nothing else may be done for this event. */
export async function manterEstadoSeViva(
  p: PortasDaConexao, c: { conId: string; item: ItemDaConexao | null | undefined; agora: Date },
): Promise<"viva" | "removida"> {
  if (!c.item) return (await p.aindaViva(c.conId)) ? "viva" : "removida";
  const escreveu = await p.gravarSeViva(c.conId, {
    status: statusParaGravar(c.item) || undefined,
    institution_name: c.item.connector?.name ?? undefined,
    institution_logo: c.item.connector?.imageUrl ?? undefined,
    updated_at: c.agora.toISOString(),
  });
  return escreveu ? "viva" : "removida";
}

/** Right before the badge and the import: the connection must still be valid. */
export async function confirmarViva(p: PortasDaConexao, conId: string): Promise<"viva" | "removida"> {
  return (await p.aindaViva(conId)) ? "viva" : "removida";
}
