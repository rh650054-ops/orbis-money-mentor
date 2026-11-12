// A8 — "Desconectar": a step that is not answered is not an answer.
import { describe, expect, it } from "vitest";
import {
  desligar, type ConexaoDoVendedor, type ItemApagado, type PortasDoDesligar,
} from "../../supabase/functions/pluggy-desligar/desligar";

const UID = "11111111-1111-1111-1111-111111111111";
const OUTRO = "22222222-2222-2222-2222-222222222222";
const CON = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const agora = new Date("2026-11-12T20:30:00Z");

type Linha = ConexaoDoVendedor & { user_id: string; updated_at: string };
const linha = (mais: Partial<Linha> = {}): Linha => ({
  id: CON, user_id: UID, item_id: "item-1", status: "UPDATED", institution_name: "Nubank",
  updated_at: "2026-11-12T10:00:00.000Z", ...mais,
});

/** A fake database and a fake Pluggy. `falhas` = how many times each step fails before answering. */
function mundo(linhas: Linha[], o: { consultaFalha?: number; marcaFalha?: number; pluggy?: ItemApagado[] } = {}) {
  let consultaFalha = o.consultaFalha ?? 0;
  let marcaFalha = o.marcaFalha ?? 0;
  const respostasDaPluggy = [...(o.pluggy ?? [])];
  const itens = new Set(linhas.map((l) => l.item_id).filter((i): i is string => !!i));
  const chamadas = { consulta: 0, apagar: [] as string[], marca: 0, espera: [] as number[] };
  const logs: { nivel: string; texto: string; dados: Record<string, unknown> }[] = [];
  const portas: PortasDoDesligar = {
    conexao: async (id, uid) => {
      chamadas.consulta++;
      if (consultaFalha > 0) { consultaFalha--; return { ok: false }; }
      const l = linhas.find((x) => x.id === id && x.user_id === uid);
      return { ok: true, con: l ? { id: l.id, item_id: l.item_id, status: l.status, institution_name: l.institution_name } : null };
    },
    apagarItem: async (itemId) => {
      chamadas.apagar.push(itemId);
      const forcada = respostasDaPluggy.shift();
      if (forcada && forcada !== "apagado" && forcada !== "ja_nao_existia") return forcada;
      if (!itens.has(itemId)) return "ja_nao_existia";
      itens.delete(itemId);
      return "apagado";
    },
    marcarRemovida: async (id, uid, quando) => {
      chamadas.marca++;
      if (marcaFalha > 0) { marcaFalha--; return false; }
      const l = linhas.find((x) => x.id === id && x.user_id === uid);
      if (!l) return false;
      l.status = "deleted"; l.updated_at = quando;
      return true;
    },
    espera: async (ms) => { chamadas.espera.push(ms); },
    registrar: (nivel, texto, dados) => { logs.push({ nivel, texto, dados }); },
  };
  return { portas, chamadas, logs, itens, linha: (id = CON) => linhas.find((x) => x.id === id) };
}
const pedir = (m: ReturnType<typeof mundo>, uid = UID, conexaoId = CON) => desligar(m.portas, { uid, conexaoId, agora });

describe("A8 — desconectar: what did not change", () => {
  it("disconnects: the Item is deleted on Pluggy, then the connection is marked removed", async () => {
    const m = mundo([linha()]);
    expect(await pedir(m)).toEqual({ http: 200, corpo: { ok: true, banco: "Nubank", pluggy: "apagado" } });
    expect(m.itens.has("item-1")).toBe(false);
    expect(m.linha()).toMatchObject({ status: "deleted", updated_at: "2026-11-12T20:30:00.000Z" });
    expect(m.chamadas).toMatchObject({ consulta: 1, apagar: ["item-1"], marca: 1, espera: [] });
    expect(m.logs).toEqual([{ nivel: "info", texto: "pluggy-desligar", dados: { conexao: CON, pluggy: "apagado" } }]);
  });
  it("Pluggy no longer knows the Item (404): the goal is met, the connection is marked", async () => {
    const m = mundo([linha()]);
    m.itens.clear();
    expect(await pedir(m)).toEqual({ http: 200, corpo: { ok: true, banco: "Nubank", pluggy: "ja_nao_existia" } });
    expect(m.linha()?.status).toBe("deleted");
  });
  it("a connection with no Item is only marked", async () => {
    const m = mundo([linha({ item_id: null })]);
    expect(await pedir(m)).toEqual({ http: 200, corpo: { ok: true, banco: "Nubank", pluggy: "sem_item" } });
    expect(m.chamadas.apagar).toEqual([]);
    expect(m.linha()?.status).toBe("deleted");
  });
  it("already removed: answers ok and touches nothing", async () => {
    const m = mundo([linha({ status: "deleted" })]);
    expect(await pedir(m)).toEqual({ http: 200, corpo: { ok: true, banco: "Nubank", ja_estava: true } });
    expect(m.chamadas).toMatchObject({ apagar: [], marca: 0 });
    expect(m.linha()?.updated_at).toBe("2026-11-12T10:00:00.000Z");
  });
  it("another seller's connection is 'nao_encontrada' and nothing is deleted", async () => {
    const m = mundo([linha()]);
    expect(await pedir(m, OUTRO)).toEqual({ http: 404, corpo: { error: "nao_encontrada" } });
    expect(m.itens.has("item-1")).toBe(true);
    expect(m.linha()?.status).toBe("UPDATED");
  });
  it("an id that is not an id is refused before anything is asked", async () => {
    const m = mundo([linha()]);
    for (const id of ["", "abc", "'; drop table bank_connections; --", `${CON}x`]) {
      expect(await pedir(m, UID, id)).toEqual({ http: 400, corpo: { error: "conexao_invalida" } });
    }
    expect(m.chamadas.consulta).toBe(0);
  });
  it("Pluggy refuses the deletion: 'pluggy_recusou', the connection stays as it was", async () => {
    const m = mundo([linha()], { pluggy: ["recusou"] });
    expect(await pedir(m)).toEqual({ http: 502, corpo: { error: "pluggy_recusou" } });
    expect(m.linha()?.status).toBe("UPDATED");
    expect(m.chamadas.marca).toBe(0);
  });
  it("no Pluggy key: 'pluggy_nao_configurado', nothing is marked", async () => {
    const m = mundo([linha()], { pluggy: ["sem_chave"] });
    expect(await pedir(m)).toEqual({ http: 503, corpo: { error: "pluggy_nao_configurado" } });
    expect(m.linha()?.status).toBe("UPDATED");
  });
});

describe("A8 — desconectar: a step that is not answered", () => {
  it("the lookup fails once and answers on the second try: the bank is disconnected", async () => {
    const m = mundo([linha()], { consultaFalha: 1 });
    expect(await pedir(m)).toEqual({ http: 200, corpo: { ok: true, banco: "Nubank", pluggy: "apagado" } });
    expect(m.chamadas).toMatchObject({ consulta: 2, espera: [300] });
    expect(m.linha()?.status).toBe("deleted");
  });
  it("the lookup fails twice: 'consulta_indisponivel', never 'nao_encontrada', and nothing is touched", async () => {
    const m = mundo([linha()], { consultaFalha: 2 });
    expect(await pedir(m)).toEqual({ http: 503, corpo: { error: "consulta_indisponivel" } });
    expect(m.chamadas).toMatchObject({ consulta: 2, apagar: [], marca: 0 });
    expect(m.itens.has("item-1")).toBe(true);
    expect(m.linha()?.status).toBe("UPDATED");
    expect(m.logs).toEqual([{ nivel: "erro", texto: "pluggy-desligar: conexao nao consultada, nada foi feito", dados: { conexao: CON } }]);
  });
  it("Pluggy does not answer the deletion: 'pluggy_sem_resposta' and the connection is NOT marked", async () => {
    const m = mundo([linha()], { pluggy: ["sem_resposta"] });
    expect(await pedir(m)).toEqual({ http: 502, corpo: { error: "pluggy_sem_resposta" } });
    expect(m.linha()?.status).toBe("UPDATED");
    expect(m.chamadas.marca).toBe(0);
    expect(m.logs[0]).toMatchObject({ nivel: "erro", dados: { conexao: CON } });
  });
  it("the mark fails once after the Item is gone: tried again, the connection ends removed", async () => {
    const m = mundo([linha()], { marcaFalha: 1 });
    expect(await pedir(m)).toEqual({ http: 200, corpo: { ok: true, banco: "Nubank", pluggy: "apagado" } });
    expect(m.chamadas).toMatchObject({ marca: 2, apagar: ["item-1"], espera: [300] });
    expect(m.linha()?.status).toBe("deleted");
  });
  it("the mark fails twice: error, the exact state is logged, and it is never reported as done", async () => {
    const m = mundo([linha()], { marcaFalha: 2 });
    expect(await pedir(m)).toEqual({ http: 500, corpo: { error: "erro_interno" } });
    expect(m.linha()?.status).toBe("UPDATED");
    expect(m.logs).toEqual([{
      nivel: "erro", texto: "pluggy-desligar: conexao NAO marcada como removida", dados: { conexao: CON, pluggy: "apagado" },
    }]);
  });
  it("after that failure, tapping 'Desconectar' again finishes it (Pluggy answers 404)", async () => {
    const m = mundo([linha()], { marcaFalha: 2 });
    await pedir(m);
    expect(await pedir(m)).toEqual({ http: 200, corpo: { ok: true, banco: "Nubank", pluggy: "ja_nao_existia" } });
    expect(m.linha()?.status).toBe("deleted");
  });
  it("after Pluggy did not answer, tapping again works whether or not the Item had been deleted", async () => {
    const naoApagou = mundo([linha()], { pluggy: ["sem_resposta"] });
    await pedir(naoApagou);
    expect((await pedir(naoApagou)).corpo).toMatchObject({ ok: true, pluggy: "apagado" });
    const apagou = mundo([linha()], { pluggy: ["sem_resposta"] });
    await pedir(apagou);
    apagou.itens.clear(); // Pluggy had in fact deleted it before the answer was lost
    expect((await pedir(apagou)).corpo).toMatchObject({ ok: true, pluggy: "ja_nao_existia" });
  });
  it("no log line carries anything but the connection id and Pluggy's result", async () => {
    for (const o of [{}, { consultaFalha: 2 }, { marcaFalha: 2 }, { pluggy: ["sem_resposta"] as ItemApagado[] }]) {
      const m = mundo([linha()], o);
      await pedir(m);
      for (const l of m.logs) expect(Object.keys(l.dados).every((k) => k === "conexao" || k === "pluggy")).toBe(true);
    }
  });
});
