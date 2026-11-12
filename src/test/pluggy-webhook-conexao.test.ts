// A7 — what the webhook does with an event, given the connection it found for the Item.
import { describe, expect, it } from "vitest";
import {
  confirmarViva, manterEstadoSeViva, tratoDoEvento, type CamposDoEstado, type PortasDaConexao,
} from "../../supabase/functions/pluggy-webhook/conexao";
import { conferirEstado, STATUS_CONHECIDOS } from "../../supabase/functions/_shared/pluggy-estado";

describe("tratoDoEvento — a removed connection never comes back on its own", () => {
  it("an event for a removed connection: nothing is written, granted or imported", () => {
    expect(tratoDoEvento({ consultou: true, con: { status: "deleted" } })).toBe("removida");
    expect(tratoDoEvento({ consultou: true, con: { status: "DELETED" } })).toBe("removida");
  });
  it("every other stored state keeps being handled as before", () => {
    for (const status of STATUS_CONHECIDOS.filter((s) => s !== "deleted")) {
      expect(tratoDoEvento({ consultou: true, con: { status } })).toBe("seguir");
    }
    // unknown or empty states are live connections too: only "deleted" is removed
    for (const status of ["connected", "ALGO_NOVO", "", null, undefined]) {
      expect(tratoDoEvento({ consultou: true, con: { status } })).toBe("seguir");
    }
  });
  it("no connection for the Item: the auto-cura decides (as before)", () => {
    expect(tratoDoEvento({ consultou: true, con: null })).toBe("criar");
    expect(tratoDoEvento({ consultou: true, con: undefined })).toBe("criar");
  });
  it("the lookup failed: it is NOT 'no connection' — the event is left alone, whatever came back", () => {
    expect(tratoDoEvento({ consultou: false, con: null })).toBe("nao_consultada");
    expect(tratoDoEvento({ consultou: false, con: undefined })).toBe("nao_consultada");
    expect(tratoDoEvento({ consultou: false, con: { status: "UPDATED" } })).toBe("nao_consultada");
  });
  it("the webhook and the robot agree: what the robot never brings back, the webhook does not touch", () => {
    const item = { status: "UPDATED", executionStatus: "SUCCESS" };
    expect(conferirEstado("deleted", item).gravar).toBeNull(); // the robot (A5)
    expect(tratoDoEvento({ consultou: true, con: { status: "deleted" } })).toBe("removida"); // the webhook (A7)
  });
});

// ---- A7, race: the seller disconnects BETWEEN the webhook's lookup and its write.
// The fake database below behaves like the real one for the two statements the webhook uses:
//   update bank_connections set ... where id = $1 and status <> 'deleted'  returning id
//   select id from bank_connections where id = $1 and status <> 'deleted'
type Linha = { id: string; status: string; institution_name: string; updated_at: string };
function banco(linhas: Linha[]) {
  const escritas: { id: string; campos: CamposDoEstado }[] = [];
  let fora = false; // the database does not answer
  const portas: PortasDaConexao = {
    gravarSeViva: async (id, campos) => {
      if (fora) return false;
      const l = linhas.find((x) => x.id === id && x.status !== "deleted"); // the condition is in the statement
      if (!l) return false;
      escritas.push({ id, campos });
      if (campos.status !== undefined) l.status = campos.status;
      if (campos.institution_name !== undefined) l.institution_name = campos.institution_name;
      l.updated_at = campos.updated_at;
      return true;
    },
    aindaViva: async (id) => !fora && linhas.some((x) => x.id === id && x.status !== "deleted"),
  };
  /** the webhook's first step: what it reads about the connection */
  const consultar = (id: string) => { const l = linhas.find((x) => x.id === id); return l ? { id: l.id, status: l.status } : null; };
  /** the seller taps "Desconectar": pluggy-desligar marks the connection removed */
  const vendedorDesconecta = (id: string) => { const l = linhas.find((x) => x.id === id); if (l) l.status = "deleted"; };
  return { portas, escritas, consultar, vendedorDesconecta, linha: (id: string) => linhas.find((x) => x.id === id), cair: () => { fora = true; } };
}
const linhaViva = (): Linha => ({ id: "con-1", status: "UPDATED", institution_name: "Nubank", updated_at: "2026-11-12T10:00:00.000Z" });
const agora = new Date("2026-11-12T20:00:00Z");
const itemAtualizado = { status: "UPDATED", executionStatus: "SUCCESS", connector: { name: "Nubank", imageUrl: "https://logo/nu" } };

describe("A7 race — removal between the lookup and the write", () => {
  it("the seller disconnects right after the lookup: the write does not go over 'deleted' and the flow stops", async () => {
    const b = banco([linhaViva()]);
    const con = b.consultar("con-1"); // the webhook sees a live connection...
    expect(tratoDoEvento({ consultou: true, con })).toBe("seguir");
    b.vendedorDesconecta("con-1"); // ...and the seller disconnects before the webhook writes
    expect(await manterEstadoSeViva(b.portas, { conId: "con-1", item: itemAtualizado, agora })).toBe("removida");
    expect(b.linha("con-1")?.status).toBe("deleted"); // not reactivated
    expect(b.escritas).toEqual([]); // nothing was written at all
  });
  it("the same race with every state Pluggy may report: 'deleted' is never overwritten", async () => {
    for (const item of [itemAtualizado, { status: "OUTDATED", executionStatus: "USER_INPUT_TIMEOUT" }, { status: "LOGIN_ERROR" }, { status: "UPDATING" }]) {
      const b = banco([linhaViva()]);
      b.consultar("con-1");
      b.vendedorDesconecta("con-1");
      expect(await manterEstadoSeViva(b.portas, { conId: "con-1", item, agora })).toBe("removida");
      expect(b.linha("con-1")?.status).toBe("deleted");
    }
  });
  it("the seller disconnects after the state was written but before the badge and the import: the flow stops there", async () => {
    const b = banco([linhaViva()]);
    b.consultar("con-1");
    expect(await manterEstadoSeViva(b.portas, { conId: "con-1", item: itemAtualizado, agora })).toBe("viva");
    b.vendedorDesconecta("con-1");
    expect(await confirmarViva(b.portas, "con-1")).toBe("removida");
    expect(b.linha("con-1")?.status).toBe("deleted");
  });
  it("no Item from Pluggy: nothing is written, and a connection removed meanwhile still stops the flow", async () => {
    const b = banco([linhaViva()]);
    expect(await manterEstadoSeViva(b.portas, { conId: "con-1", item: null, agora })).toBe("viva");
    expect(b.escritas).toEqual([]);
    b.vendedorDesconecta("con-1");
    expect(await manterEstadoSeViva(b.portas, { conId: "con-1", item: null, agora })).toBe("removida");
  });
  it("nobody disconnected: the state is kept honest exactly as before", async () => {
    const b = banco([{ ...linhaViva(), status: "OUTDATED" }]);
    expect(await manterEstadoSeViva(b.portas, { conId: "con-1", item: { status: "OUTDATED", executionStatus: "USER_INPUT_TIMEOUT", connector: { name: "Nubank" } }, agora })).toBe("viva");
    expect(b.linha("con-1")).toMatchObject({ status: "USER_INPUT_TIMEOUT", institution_name: "Nubank", updated_at: "2026-11-12T20:00:00.000Z" });
    expect(await confirmarViva(b.portas, "con-1")).toBe("viva");
    expect(b.escritas).toHaveLength(1);
    expect(b.escritas[0]?.campos).toEqual({ status: "USER_INPUT_TIMEOUT", institution_name: "Nubank", institution_logo: undefined, updated_at: "2026-11-12T20:00:00.000Z" });
  });
  it("an Item with no status from Pluggy does not erase the stored one", async () => {
    const b = banco([linhaViva()]);
    expect(await manterEstadoSeViva(b.portas, { conId: "con-1", item: { connector: { name: "Nubank" } }, agora })).toBe("viva");
    expect(b.linha("con-1")?.status).toBe("UPDATED");
    expect(b.escritas[0]?.campos.status).toBeUndefined();
  });
  it("the database cannot confirm the connection: no badge and no import either", async () => {
    const b = banco([linhaViva()]);
    b.cair();
    expect(await manterEstadoSeViva(b.portas, { conId: "con-1", item: itemAtualizado, agora })).toBe("removida");
    expect(await confirmarViva(b.portas, "con-1")).toBe("removida");
    expect(b.linha("con-1")?.status).toBe("UPDATED"); // and nothing was changed
  });
  it("a connection that does not exist is never created by this step", async () => {
    const b = banco([]);
    expect(await manterEstadoSeViva(b.portas, { conId: "nao-existe", item: itemAtualizado, agora })).toBe("removida");
    expect(b.escritas).toEqual([]);
  });
});
