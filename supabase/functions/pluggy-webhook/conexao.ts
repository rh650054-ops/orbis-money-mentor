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

import { grupoDoStatus } from "../_shared/pluggy-estado.ts";

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
