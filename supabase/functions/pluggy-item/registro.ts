// A2 (12/11/2026) — validating and registering the bank Item, as one flow that can be tested
// without Deno, Pluggy or the database: everything it touches comes in through `Portas`.
//
// What the flow guarantees (Module A, flow A2):
//   1. the Item exists on Pluggy (asked there, never trusted from the screen);
//   2. it belongs to the signed-in seller — Pluggy's clientUserId, stamped by our connect token,
//      or, for an Item with no clientUserId, a connection of this same seller that already exists.
//      A stored connection never changes owner;
//   3. the seller has an active plan;
//   4. a NEW connection needs a free slot in the plan — and a slot that could not be checked is
//      not a free slot: nothing is registered and nothing is deleted on Pluggy;
//   5. an Item that is already this seller's connection (reauthorisation, repeated call) takes no
//      slot and is never deleted on Pluggy;
//   6. repeated calls end in the same single row (item_id is unique);
//   7. entries and accounts are read only for the verified owner and only into that connection;
//   8. the stored state is what Pluggy said — never a guessed "UPDATED" — and "last read" is
//      written only after a read really happened. A3: when Pluggy's reason depends on the seller
//      (authorisation not finished, revoked, credentials), that reason is what is stored.

import { statusParaGravar } from "../_shared/pluggy-estado.ts";

export type ItemPluggy = {
  status?: string | null;
  executionStatus?: string | null;
  error?: { code?: string | null } | null;
  consentExpiresAt?: string | null;
  clientUserId?: string | null;
  connector?: { name?: string | null; imageUrl?: string | null } | null;
};

/** The row of bank_connections that already holds this item_id, if any. */
export type Linha = { id: string; user_id: string; status: string | null; leitura_ok_em: string | null };

/** What is written on registration. No last_synced_at: registering is not reading. */
export type Gravacao = {
  user_id: string; item_id: string; institution_name: string; institution_logo: string | null;
  status: string; updated_at: string;
};

export type Resposta = { corpo: Record<string, unknown>; http: number };

/** Answer of the slot check (same values as _shared/pluggy-vaga.ts). */
export type Vaga = "cabe" | "sem_vaga" | "indisponivel";

export interface Portas {
  ehPro(uid: string): Promise<boolean>;
  /** The Item as Pluggy has it; null when Pluggy does not know it; "sem_chave" when Pluggy is not configured. */
  buscarItem(itemId: string): Promise<ItemPluggy | null | "sem_chave">;
  /** Throws when the database cannot answer: ownership must never be decided blind. */
  linhaDoItem(itemId: string): Promise<Linha | null>;
  vaga(uid: string, banco: string, itemId: string): Promise<Vaga>;
  apagarNaPluggy(itemId: string): Promise<void>;
  /** null when the row was not saved. */
  gravar(linha: Gravacao): Promise<{ id: string; leitura_ok_em: string | null } | null>;
  concederSelo(uid: string): Promise<boolean>;
  lerEntradas(p: { conId: string; uid: string; itemId: string; item: ItemPluggy; leituraOk: string | null }): Promise<{ gravadas: number; carimbo: string | null }>;
  marcarLeitura(conId: string, p: { lidoEm: string; carimbo: string | null }): Promise<void>;
  lerPiloto(p: { conId: string; uid: string; itemId: string; banco: string }): Promise<void>;
  agora(): Date;
  avisar(msg: string, detalhe?: unknown): void;
}

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** May this seller register this Item? `nova` = it is not one of the seller's live connections yet. */
export function donoDoItem(p: { uid: string; clientUserId: string | null | undefined; existente: Linha | null }):
  { ok: true; nova: boolean } | { ok: false } {
  if (p.existente && p.existente.user_id !== p.uid) return { ok: false }; // a connection never changes owner
  const dono = texto(p.clientUserId);
  if (dono && dono !== p.uid) return { ok: false };
  if (!dono && !p.existente) return { ok: false }; // nobody's Item on Pluggy and not ours here: not provable
  return { ok: true, nova: !p.existente || p.existente.status === "deleted" };
}

/** State to store: what Pluggy said (pluggy-estado.ts). Without it, what we already had; a new
 *  connection is "UPDATING". */
export function estadoParaGravar(item: ItemPluggy, existente: Linha | null): string {
  const s = statusParaGravar(item);
  if (s) return s;
  const antigo = texto(existente?.status);
  return antigo && antigo !== "deleted" ? antigo : "UPDATING";
}

const COM_SELO = new Set(["UPDATED", "UPDATING", "LOGIN_IN_PROGRESS"]);
const r = (corpo: Record<string, unknown>, http = 200): Resposta => ({ corpo, http });

export async function registrarItem(p: Portas, uid: string, itemBruto: unknown): Promise<Resposta> {
  if (!(await p.ehPro(uid))) return r({ error: "precisa_pro" });

  const itemId = String(itemBruto ?? "").trim();
  if (!itemId) return r({ error: "faltou_item" }, 400);

  const item = await p.buscarItem(itemId);
  if (item === "sem_chave") return r({ error: "pluggy_nao_configurado" });
  if (!item) return r({ error: "item_invalido" });

  const existente = await p.linhaDoItem(itemId);
  const dono = donoDoItem({ uid, clientUserId: item.clientUserId, existente });
  if (!dono.ok) {
    p.avisar("pluggy item de outro usuario", itemId);
    return r({ error: "item_de_outro" }, 403);
  }

  const statusPluggy = texto(item.status);
  const banco = String(item.connector?.name ?? "Banco");
  const logo = item.connector?.imageUrl ?? null;

  // a different bank only fits under the plan's limit; an Item that is already ours takes no slot
  if (dono.nova) {
    const vaga = await p.vaga(uid, banco, itemId);
    if (vaga === "sem_vaga") { // the limit is known and exceeded: the only case that deletes the Item
      await p.apagarNaPluggy(itemId);
      return r({ error: "precisa_banco_extra" });
    }
    if (vaga !== "cabe") { // the limit could not be checked: temporary, nothing is created or deleted
      p.avisar("pluggy-item: limite indisponivel, conexao nao registrada", itemId);
      return r({ error: "limite_indisponivel" }, 503);
    }
  }

  const estado = estadoParaGravar(item, existente);
  const con = await p.gravar({
    user_id: uid, item_id: itemId, institution_name: banco, institution_logo: logo,
    status: estado, updated_at: p.agora().toISOString(),
  });
  if (!con) return r({ error: "erro_ao_salvar" }, 500); // no badge and no import for a connection that does not exist

  // A4: the same bank again is another connection. Nothing is deleted here because of the bank's
  // name: a personal and a business account at one bank are two accounts.

  // ---- SELO: conectou banco, virou verificado
  const selo = COM_SELO.has(statusPluggy) ? await p.concederSelo(uid) : false;

  // ---- primeira leva de entradas, ja. Falha aqui nao derruba a conexao.
  let entradas = 0;
  if (statusPluggy === "UPDATED") {
    try {
      const lido = await p.lerEntradas({ conId: con.id, uid, itemId, item, leituraOk: con.leitura_ok_em });
      entradas = lido.gravadas;
      await p.marcarLeitura(con.id, { lidoEm: p.agora().toISOString(), carimbo: lido.carimbo });
    } catch (e) {
      p.avisar("pluggy-item: importar falhou", (e as Error)?.message);
    }
    try {
      await p.lerPiloto({ conId: con.id, uid, itemId, banco });
    } catch (e) {
      p.avisar("pluggy-item: piloto falhou", (e as Error)?.message);
    }
  }

  return r({ ok: true, banco, status: estado, verificado: selo, entradas });
}
