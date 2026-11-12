// Vant — what a "Desconectar" request does (pure: tested in vitest).
//
// The order is the one of 03/10/2026 and does not change:
//   1) the connection must be the seller's own (by login, never by the request body);
//   2) the Item is deleted on Pluggy: the Vant loses access to the bank right away;
//   3) the connection is marked 'deleted'. Nothing is erased: what was read stays in the history.
//
// A8 (12/11/2026): each step can FAIL to be answered, and a failed step is not an answer.
//   * the lookup of the connection failing used to be read as "nao_encontrada": the seller was told
//     the bank did not exist. It is asked once more; still unanswered -> "consulta_indisponivel";
//   * Pluggy not answering the deletion (timeout, network) fell into the generic error with no
//     trace of where it stopped. It now ends as "pluggy_sem_resposta": nothing is marked, because
//     the Vant cannot tell whether it still has access;
//   * the Item deleted on Pluggy and the mark failing left a live connection with no Item behind
//     it, with nothing in the logs telling it apart. The mark is tried once more and, if it still
//     fails, that exact state is logged. Tapping "Desconectar" again finishes it (Pluggy answers
//     404, the connection is marked).
// The mark is only reported as done when the database says a row was written.

export type ConexaoDoVendedor = {
  id: string;
  item_id: string | null;
  status: string | null;
  institution_name: string | null;
};

/** What Pluggy answered to the deletion of the Item. */
export type ItemApagado = "apagado" | "ja_nao_existia" | "recusou" | "sem_resposta" | "sem_chave";

export interface PortasDoDesligar {
  /** ok:false = the question could not be answered (never "there is no such connection") */
  conexao(conexaoId: string, uid: string): Promise<{ ok: true; con: ConexaoDoVendedor | null } | { ok: false }>;
  apagarItem(itemId: string): Promise<ItemApagado>;
  /** true only when the database reports the row as written */
  marcarRemovida(conexaoId: string, uid: string, agora: string): Promise<boolean>;
  espera(ms: number): Promise<void>;
  registrar(nivel: "info" | "erro", texto: string, dados: Record<string, unknown>): void;
}

export type RespostaDoDesligar = { http: number; corpo: Record<string, unknown> };

const ID = /^[0-9a-f-]{36}$/i;

export async function desligar(
  p: PortasDoDesligar,
  c: { uid: string; conexaoId: string; agora: Date; esperaMs?: number },
): Promise<RespostaDoDesligar> {
  const esperaMs = c.esperaMs ?? 300;
  if (!ID.test(c.conexaoId)) return { http: 400, corpo: { error: "conexao_invalida" } };

  let lida = await p.conexao(c.conexaoId, c.uid);
  if (!lida.ok) {
    await p.espera(esperaMs);
    lida = await p.conexao(c.conexaoId, c.uid);
  }
  if (!lida.ok) {
    p.registrar("erro", "pluggy-desligar: conexao nao consultada, nada foi feito", { conexao: c.conexaoId });
    return { http: 503, corpo: { error: "consulta_indisponivel" } };
  }
  const con = lida.con;
  if (!con) return { http: 404, corpo: { error: "nao_encontrada" } };
  if (con.status === "deleted") return { http: 200, corpo: { ok: true, banco: con.institution_name, ja_estava: true } };

  let pluggy: "sem_item" | "apagado" | "ja_nao_existia" = "sem_item";
  if (con.item_id) {
    const r = await p.apagarItem(con.item_id);
    if (r === "sem_chave") return { http: 503, corpo: { error: "pluggy_nao_configurado" } };
    if (r === "recusou") return { http: 502, corpo: { error: "pluggy_recusou" } };
    if (r === "sem_resposta") {
      p.registrar("erro", "pluggy-desligar: a Pluggy nao respondeu, conexao nao foi marcada", { conexao: con.id });
      return { http: 502, corpo: { error: "pluggy_sem_resposta" } };
    }
    pluggy = r;
  }

  const agora = c.agora.toISOString();
  let marcou = await p.marcarRemovida(con.id, c.uid, agora);
  if (!marcou) {
    await p.espera(esperaMs);
    marcou = await p.marcarRemovida(con.id, c.uid, agora);
  }
  if (!marcou) {
    p.registrar("erro", "pluggy-desligar: conexao NAO marcada como removida", { conexao: con.id, pluggy });
    return { http: 500, corpo: { error: "erro_interno" } };
  }
  p.registrar("info", "pluggy-desligar", { conexao: con.id, pluggy });
  return { http: 200, corpo: { ok: true, banco: con.institution_name, pluggy } };
}
