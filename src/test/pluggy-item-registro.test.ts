// A2 — validating and registering the bank Item (pluggy-item).
// The whole flow runs here against a small fake world: Pluggy's items, our bank_connections rows
// and the plan's limit. The slot rule is the real one (decidirVaga).
import { describe, expect, it } from "vitest";
import {
  donoDoItem, estadoParaGravar, registrarItem, type Gravacao, type ItemPluggy, type Linha, type Portas,
} from "../../supabase/functions/pluggy-item/registro";
import { decidirVaga, type Ativa } from "../../supabase/functions/_shared/pluggy-vaga";

type LinhaDoBanco = Linha & { item_id: string; institution_name: string; created_at: string; last_synced_at: string | null };

const ANA = "ana-uid";
const BIA = "bia-uid";

function mundo() {
  const m = {
    pro: new Set<string>([ANA, BIA]),
    limite: new Map<string, number | null>([[ANA, 1], [BIA, 1]]),
    pluggy: new Map<string, ItemPluggy>(),
    linhas: [] as LinhaDoBanco[],
    semChave: false,
    bancoFora: false,
    falhaAoGravar: false,
    falhaAoImportar: false,
    limiteFora: false, // open_finance_limite did not answer
    ativasFora: false, // the seller's connections could not be read
    consultasDeVaga: 0,
    carimbo: null as string | null,
    relogio: Date.parse("2026-11-12T12:00:00Z"),
    // what happened
    pedidosAPluggy: [] as string[],
    apagadosNaPluggy: [] as string[],
    gravacoes: [] as Gravacao[],
    selos: [] as string[],
    leituras: [] as { conId: string; uid: string; itemId: string }[],
    contas: [] as { conId: string; uid: string; itemId: string }[],
    avisos: [] as string[],
    seq: 0,
  };
  const vivas = (uid: string): Ativa[] => m.linhas.filter((l) => l.user_id === uid && l.status !== "deleted")
    .map((l) => ({ id: l.id, item_id: l.item_id, institution_name: l.institution_name, created_at: l.created_at }));
  const portas: Portas = {
    ehPro: async (uid) => m.pro.has(uid),
    buscarItem: async (itemId) => {
      if (m.semChave) return "sem_chave";
      m.pedidosAPluggy.push(itemId);
      return m.pluggy.get(itemId) ?? null;
    },
    linhaDoItem: async (itemId) => {
      if (m.bancoFora) throw new Error("bank_connections: timeout");
      const l = m.linhas.find((x) => x.item_id === itemId);
      return l ? { id: l.id, user_id: l.user_id, status: l.status, leitura_ok_em: l.leitura_ok_em } : null;
    },
    vaga: async (uid, _banco, itemId) => {
      m.consultasDeVaga++;
      return decidirVaga({
        ativas: m.ativasFora ? null : vivas(uid), limite: m.limiteFora ? undefined : m.limite.get(uid) ?? null, itemId,
      });
    },
    apagarNaPluggy: async (itemId) => { m.apagadosNaPluggy.push(itemId); m.pluggy.delete(itemId); },
    gravar: async (g) => {
      m.gravacoes.push(g);
      if (m.falhaAoGravar) return null;
      const l = m.linhas.find((x) => x.item_id === g.item_id); // upsert on item_id
      if (l) {
        Object.assign(l, { user_id: g.user_id, institution_name: g.institution_name, status: g.status });
        return { id: l.id, leitura_ok_em: l.leitura_ok_em };
      }
      const nova: LinhaDoBanco = {
        id: `con-${++m.seq}`, user_id: g.user_id, item_id: g.item_id, institution_name: g.institution_name,
        status: g.status, leitura_ok_em: null, last_synced_at: null, created_at: new Date(m.relogio).toISOString(),
      };
      m.linhas.push(nova);
      return { id: nova.id, leitura_ok_em: null };
    },
    concederSelo: async (uid) => { m.selos.push(uid); return true; },
    lerEntradas: async ({ conId, uid, itemId }) => {
      if (m.falhaAoImportar) throw new Error("pluggy 500");
      m.leituras.push({ conId, uid, itemId });
      return { gravadas: 7, carimbo: m.carimbo };
    },
    marcarLeitura: async (conId, { lidoEm, carimbo }) => {
      const l = m.linhas.find((x) => x.id === conId);
      if (!l) return;
      l.last_synced_at = lidoEm;
      if (carimbo) l.leitura_ok_em = carimbo;
    },
    lerPiloto: async ({ conId, uid, itemId }) => { m.contas.push({ conId, uid, itemId }); },
    agora: () => new Date((m.relogio += 1000)),
    avisar: (msg) => { m.avisos.push(msg); },
  };
  const item = (id: string, dono: string | null, banco: string, status: string | null = "UPDATED") =>
    m.pluggy.set(id, { status, clientUserId: dono, connector: { name: banco, imageUrl: `https://logo/${banco}` } });
  const linha = (id: string, dono: string, itemId: string, banco: string, status = "UPDATED", extra: Partial<LinhaDoBanco> = {}) => {
    const l: LinhaDoBanco = { id, user_id: dono, item_id: itemId, institution_name: banco, status, leitura_ok_em: null,
      last_synced_at: "2026-11-10T09:00:00.000Z", created_at: "2026-10-01T00:00:00.000Z", ...extra };
    m.linhas.push(l);
    return l;
  };
  const registrar = (uid: string, itemId: unknown) => registrarItem(portas, uid, itemId);
  const linhaDe = (itemId: string) => m.linhas.find((l) => l.item_id === itemId);
  return { m, item, linha, registrar, linhaDe };
}

describe("A2.1 — the Item must exist on Pluggy", () => {
  it("an Item Pluggy does not know is refused and nothing is written", async () => {
    const w = mundo();
    const r = await w.registrar(ANA, "nao-existe");
    expect(r.corpo).toEqual({ error: "item_invalido" });
    expect(w.m.linhas).toHaveLength(0);
    expect(w.m.selos).toHaveLength(0);
    expect(w.m.leituras).toHaveLength(0);
  });
  it("no item id: 400 and Pluggy is not even asked", async () => {
    const w = mundo();
    for (const vazio of ["", "   ", null, undefined]) {
      const r = await w.registrar(ANA, vazio);
      expect(r).toEqual({ corpo: { error: "faltou_item" }, http: 400 });
    }
    expect(w.m.pedidosAPluggy).toHaveLength(0);
  });
  it("Pluggy not configured is said as such", async () => {
    const w = mundo();
    w.m.semChave = true;
    expect((await w.registrar(ANA, "it-1")).corpo).toEqual({ error: "pluggy_nao_configurado" });
  });
  it("an existing Item of the seller is registered", async () => {
    const w = mundo();
    w.item("it-1", ANA, "Nubank");
    const r = await w.registrar(ANA, "it-1");
    expect(r).toEqual({ corpo: { ok: true, banco: "Nubank", status: "UPDATED", verificado: true, entradas: 7 }, http: 200 });
    expect(w.linhaDe("it-1")).toMatchObject({ user_id: ANA, institution_name: "Nubank", status: "UPDATED" });
  });
});

describe("A2.2 — the Item must belong to the signed-in seller", () => {
  it("an Item stamped for another seller: 403, nothing written, nothing deleted on Pluggy", async () => {
    const w = mundo();
    w.item("it-bia", BIA, "Itaú");
    const r = await w.registrar(ANA, "it-bia");
    expect(r).toEqual({ corpo: { error: "item_de_outro" }, http: 403 });
    expect(w.m.linhas).toHaveLength(0);
    expect(w.m.apagadosNaPluggy).toHaveLength(0);
    expect(w.m.selos).toHaveLength(0);
    expect(w.m.contas).toHaveLength(0);
  });
  it("an Item with no owner on Pluggy and no connection here is nobody's: refused", async () => {
    const w = mundo();
    w.item("it-solto", null, "Itaú");
    expect(await w.registrar(ANA, "it-solto")).toEqual({ corpo: { error: "item_de_outro" }, http: 403 });
    w.item("it-solto2", "   ", "Itaú");
    expect((await w.registrar(ANA, "it-solto2")).http).toBe(403);
    expect(w.m.linhas).toHaveLength(0);
  });
  it("the stored connection of another seller never changes owner, whatever the Item says", async () => {
    const w = mundo();
    const dela = w.linha("con-bia", BIA, "it-x", "Itaú");
    for (const dono of [null, ANA]) { // no owner on Pluggy, or even Pluggy naming the caller
      w.item("it-x", dono, "Itaú");
      expect(await w.registrar(ANA, "it-x")).toEqual({ corpo: { error: "item_de_outro" }, http: 403 });
    }
    expect(dela).toMatchObject({ user_id: BIA, status: "UPDATED" });
    expect(w.m.gravacoes).toHaveLength(0);
  });
  it("a seller at the plan's limit cannot get another seller's Item deleted on Pluggy", async () => {
    const w = mundo();
    w.linha("con-ana", ANA, "it-ana", "Nubank"); // Ana is full (limit 1)
    w.linha("con-bia", BIA, "it-bia", "Itaú");
    w.item("it-bia", null, "Itaú");
    expect((await w.registrar(ANA, "it-bia")).http).toBe(403);
    expect(w.m.apagadosNaPluggy).toHaveLength(0);
    expect(w.m.pluggy.has("it-bia")).toBe(true);
  });
  it("an old Item with no owner on Pluggy that is already this seller's connection is accepted", async () => {
    const w = mundo();
    w.linha("con-ana", ANA, "it-antigo", "Nubank", "LOGIN_ERROR");
    w.item("it-antigo", null, "Nubank");
    const r = await w.registrar(ANA, "it-antigo");
    expect(r.corpo).toMatchObject({ ok: true, status: "UPDATED" });
    expect(w.m.linhas).toHaveLength(1);
  });
  it("Pluggy saying the Item is someone else's wins over our own row", async () => {
    const w = mundo();
    w.linha("con-ana", ANA, "it-1", "Nubank");
    w.item("it-1", BIA, "Nubank");
    expect((await w.registrar(ANA, "it-1")).http).toBe(403);
  });
  it("when the database cannot say who owns the Item, nothing is decided", async () => {
    const w = mundo();
    w.item("it-1", ANA, "Nubank");
    w.m.bancoFora = true;
    await expect(w.registrar(ANA, "it-1")).rejects.toThrow("bank_connections");
    expect(w.m.gravacoes).toHaveLength(0);
  });
});

describe("A2.3 — the seller needs an active plan", () => {
  it("without Pro: refused before Pluggy is asked, nothing written", async () => {
    const w = mundo();
    w.m.pro.delete(ANA);
    w.item("it-1", ANA, "Nubank");
    expect(await w.registrar(ANA, "it-1")).toEqual({ corpo: { error: "precisa_pro" }, http: 200 });
    expect(w.m.pedidosAPluggy).toHaveLength(0);
    expect(w.m.linhas).toHaveLength(0);
  });
});

describe("A2.4 — a new connection needs a free slot", () => {
  it("Pro monthly with Nubank: a second bank is refused, its Item deleted on Pluggy, no row", async () => {
    const w = mundo();
    w.linha("con-1", ANA, "it-nu", "Nubank");
    w.item("it-itau", ANA, "Itaú");
    expect(await w.registrar(ANA, "it-itau")).toEqual({ corpo: { error: "precisa_banco_extra" }, http: 200 });
    expect(w.m.apagadosNaPluggy).toEqual(["it-itau"]);
    expect(w.m.linhas).toHaveLength(1);
    expect(w.m.selos).toHaveLength(0);
    expect(w.m.leituras).toHaveLength(0);
  });
  it("annual (2 banks) with one bank: the second fits", async () => {
    const w = mundo();
    w.m.limite.set(ANA, 2);
    w.linha("con-1", ANA, "it-nu", "Nubank");
    w.item("it-itau", ANA, "Itaú");
    expect((await w.registrar(ANA, "it-itau")).corpo).toMatchObject({ ok: true, banco: "Itaú" });
    expect(w.m.linhas.filter((l) => l.status !== "deleted")).toHaveLength(2);
  });
  it("first bank of a Pro monthly seller fits", async () => {
    const w = mundo();
    w.item("it-nu", ANA, "Nubank");
    expect((await w.registrar(ANA, "it-nu")).corpo).toMatchObject({ ok: true });
  });
  it("a connection removed before counts as new again: the slot is checked", async () => {
    const w = mundo();
    w.linha("con-1", ANA, "it-nu", "Nubank");
    w.linha("con-2", ANA, "it-itau", "Itaú", "deleted");
    w.item("it-itau", ANA, "Itaú");
    expect((await w.registrar(ANA, "it-itau")).corpo).toEqual({ error: "precisa_banco_extra" });
    expect(w.linhaDe("it-itau")?.status).toBe("deleted");
  });
});

describe("A2.4 — a slot that could not be checked is not a free slot", () => {
  for (const [nome, quebra] of [["the plan's limit", "limiteFora"], ["the seller's connections", "ativasFora"]] as const) {
    it(`${nome} cannot be read: 503, nothing registered, the Item stays on Pluggy`, async () => {
      const w = mundo();
      w.m[quebra] = true;
      w.item("it-nu", ANA, "Nubank");
      expect(await w.registrar(ANA, "it-nu")).toEqual({ corpo: { error: "limite_indisponivel" }, http: 503 });
      expect(w.m.linhas).toHaveLength(0);
      expect(w.m.gravacoes).toHaveLength(0);
      expect(w.m.apagadosNaPluggy).toHaveLength(0);
      expect(w.m.pluggy.has("it-nu")).toBe(true);
      expect(w.m.selos).toHaveLength(0);
      expect(w.m.leituras).toHaveLength(0);
      expect(w.m.contas).toHaveLength(0);
      expect(w.m.avisos).toContain("pluggy-item: limite indisponivel, conexao nao registrada");
    });
    it(`${nome} cannot be read: a seller who is really over the limit is not told "sem vaga" either`, async () => {
      const w = mundo();
      w.linha("con-1", ANA, "it-nu", "Nubank");
      w.m[quebra] = true;
      w.item("it-itau", ANA, "Itaú");
      expect((await w.registrar(ANA, "it-itau")).corpo).toEqual({ error: "limite_indisponivel" });
      expect(w.m.apagadosNaPluggy).toHaveLength(0);
    });
    it(`${nome} cannot be read: reauthorising a connected bank still works, and the slot is not even asked`, async () => {
      const w = mundo();
      w.linha("con-1", ANA, "it-nu", "Nubank", "LOGIN_ERROR");
      w.m[quebra] = true;
      w.item("it-nu", ANA, "Nubank");
      expect((await w.registrar(ANA, "it-nu")).corpo).toMatchObject({ ok: true, status: "UPDATED" });
      expect(w.m.consultasDeVaga).toBe(0);
      expect(w.m.apagadosNaPluggy).toHaveLength(0);
    });
  }
  it("the same call after the failure has passed registers the bank (same Item, one row)", async () => {
    const w = mundo();
    w.item("it-nu", ANA, "Nubank");
    w.m.limiteFora = true;
    expect((await w.registrar(ANA, "it-nu")).http).toBe(503);
    w.m.limiteFora = false;
    expect((await w.registrar(ANA, "it-nu")).corpo).toMatchObject({ ok: true, banco: "Nubank" });
    expect(w.m.linhas).toHaveLength(1);
  });
  it("a limit that is known and exceeded is still refused and its Item deleted", async () => {
    const w = mundo();
    w.linha("con-1", ANA, "it-nu", "Nubank");
    w.item("it-itau", ANA, "Itaú");
    expect(await w.registrar(ANA, "it-itau")).toEqual({ corpo: { error: "precisa_banco_extra" }, http: 200 });
    expect(w.m.apagadosNaPluggy).toEqual(["it-itau"]);
  });
});

describe("A2.5 — reauthorising an Item that is already connected takes no slot", () => {
  it("seller over the limit (plan went down) reauthorises a bank: accepted, Item kept on Pluggy", async () => {
    const w = mundo();
    w.linha("con-1", ANA, "it-nu", "Nubank");
    w.linha("con-2", ANA, "it-itau", "Itaú", "LOGIN_ERROR"); // 2 banks, limit is now 1
    w.item("it-itau", ANA, "Itaú");
    const r = await w.registrar(ANA, "it-itau");
    expect(r.corpo).toMatchObject({ ok: true, banco: "Itaú", status: "UPDATED" });
    expect(w.m.apagadosNaPluggy).toHaveLength(0);
    expect(w.m.pluggy.has("it-itau")).toBe(true);
    expect(w.m.linhas.map((l) => `${l.id}:${l.status}`)).toEqual(["con-1:UPDATED", "con-2:UPDATED"]);
  });
  it("seller exactly at the limit reauthorises the only bank: same row, same id", async () => {
    const w = mundo();
    w.linha("con-1", ANA, "it-nu", "Nubank", "WAITING_USER_INPUT");
    w.item("it-nu", ANA, "Nubank");
    expect((await w.registrar(ANA, "it-nu")).corpo).toMatchObject({ ok: true });
    expect(w.m.linhas).toHaveLength(1);
    expect(w.linhaDe("it-nu")).toMatchObject({ id: "con-1", status: "UPDATED" });
  });
});

describe("A2.6 — repeated calls do not create duplicates", () => {
  it("the same Item saved three times is one row with the same id", async () => {
    const w = mundo();
    w.item("it-nu", ANA, "Nubank");
    const ids = new Set<string>();
    for (let i = 0; i < 3; i++) {
      expect((await w.registrar(ANA, "it-nu")).corpo).toMatchObject({ ok: true });
      ids.add(w.linhaDe("it-nu")?.id ?? "");
    }
    expect(w.m.linhas).toHaveLength(1);
    expect(ids.size).toBe(1);
    expect(new Set(w.m.leituras.map((l) => l.conId)).size).toBe(1);
    expect(w.m.apagadosNaPluggy).toHaveLength(0);
  });
  it("the webhook saved the connection first: the app's call lands on that same row", async () => {
    const w = mundo();
    w.linha("con-webhook", ANA, "it-nu", "Nubank", "UPDATING", { last_synced_at: null });
    w.item("it-nu", ANA, "Nubank");
    await w.registrar(ANA, "it-nu");
    expect(w.m.linhas).toHaveLength(1);
    expect(w.linhaDe("it-nu")?.id).toBe("con-webhook");
  });
  it("when saving fails the answer is an error: no badge, no import, no accounts", async () => {
    const w = mundo();
    w.item("it-nu", ANA, "Nubank");
    w.m.falhaAoGravar = true;
    expect(await w.registrar(ANA, "it-nu")).toEqual({ corpo: { error: "erro_ao_salvar" }, http: 500 });
    expect(w.m.selos).toHaveLength(0);
    expect(w.m.leituras).toHaveLength(0);
    expect(w.m.contas).toHaveLength(0);
  });
});

describe("A2.7 — entries and accounts go to the right seller", () => {
  it("each seller's read uses that seller's id and that seller's connection", async () => {
    const w = mundo();
    w.item("it-ana", ANA, "Nubank");
    w.item("it-bia", BIA, "Nubank");
    await w.registrar(ANA, "it-ana");
    await w.registrar(BIA, "it-bia");
    const conAna = w.linhaDe("it-ana")?.id;
    const conBia = w.linhaDe("it-bia")?.id;
    expect(conAna).not.toBe(conBia);
    expect(w.m.leituras).toEqual([{ conId: conAna, uid: ANA, itemId: "it-ana" }, { conId: conBia, uid: BIA, itemId: "it-bia" }]);
    expect(w.m.contas).toEqual([{ conId: conAna, uid: ANA, itemId: "it-ana" }, { conId: conBia, uid: BIA, itemId: "it-bia" }]);
    expect(w.linhaDe("it-ana")?.user_id).toBe(ANA);
    expect(w.linhaDe("it-bia")?.user_id).toBe(BIA);
  });
  it("a refused Item is never read", async () => {
    const w = mundo();
    w.item("it-bia", BIA, "Nubank");
    await w.registrar(ANA, "it-bia");
    expect(w.m.leituras).toHaveLength(0);
    expect(w.m.contas).toHaveLength(0);
  });
});

describe("A2.8 — the connection's state is what Pluggy said", () => {
  it.each(["UPDATED", "UPDATING", "LOGIN_IN_PROGRESS", "LOGIN_ERROR", "WAITING_USER_INPUT", "OUTDATED"])("%s is stored as it came", async (status) => {
    const w = mundo();
    w.item("it-1", ANA, "Nubank", status);
    expect((await w.registrar(ANA, "it-1")).corpo).toMatchObject({ ok: true, status });
    expect(w.linhaDe("it-1")?.status).toBe(status);
  });
  it("the badge is granted only while Pluggy says the bank is in or being read", async () => {
    for (const [status, selo] of [["UPDATED", true], ["UPDATING", true], ["LOGIN_IN_PROGRESS", true],
      ["LOGIN_ERROR", false], ["WAITING_USER_INPUT", false], ["OUTDATED", false], [null, false]] as const) {
      const w = mundo();
      w.item("it-1", ANA, "Nubank", status);
      expect((await w.registrar(ANA, "it-1")).corpo.verificado).toBe(selo);
      expect(w.m.selos).toHaveLength(selo ? 1 : 0);
    }
  });
  it("no status from Pluggy on a new connection is 'UPDATING', never a guessed 'UPDATED'", async () => {
    const w = mundo();
    w.item("it-1", ANA, "Nubank", null);
    expect((await w.registrar(ANA, "it-1")).corpo).toMatchObject({ ok: true, status: "UPDATING", entradas: 0 });
    expect(w.linhaDe("it-1")?.status).toBe("UPDATING");
    expect(w.m.leituras).toHaveLength(0);
  });
  it("no status from Pluggy on an existing connection keeps the state we had", async () => {
    const w = mundo();
    w.linha("con-1", ANA, "it-1", "Nubank", "LOGIN_ERROR");
    w.item("it-1", ANA, "Nubank", "");
    await w.registrar(ANA, "it-1");
    expect(w.linhaDe("it-1")?.status).toBe("LOGIN_ERROR");
  });
  it("A3: the seller left the authorisation unfinished — stored as that, no badge, nothing read", async () => {
    const w = mundo();
    w.m.pluggy.set("it-1", { status: "OUTDATED", executionStatus: "USER_INPUT_TIMEOUT", clientUserId: ANA, connector: { name: "Inter" } });
    expect((await w.registrar(ANA, "it-1")).corpo).toMatchObject({ ok: true, status: "USER_INPUT_TIMEOUT", verificado: false, entradas: 0 });
    expect(w.linhaDe("it-1")?.status).toBe("USER_INPUT_TIMEOUT");
    expect(w.m.leituras).toHaveLength(0);
  });
  it("A3: reauthorising that same Item brings it back to what Pluggy says, in the same row", async () => {
    const w = mundo();
    w.linha("con-1", ANA, "it-1", "Inter", "USER_INPUT_TIMEOUT");
    w.item("it-1", ANA, "Inter", "UPDATED");
    expect((await w.registrar(ANA, "it-1")).corpo).toMatchObject({ ok: true, status: "UPDATED", verificado: true });
    expect(w.m.linhas).toHaveLength(1);
    expect(w.linhaDe("it-1")).toMatchObject({ id: "con-1", status: "UPDATED" });
    expect(w.m.consultasDeVaga).toBe(0);
    expect(w.m.apagadosNaPluggy).toHaveLength(0);
  });
  it("registering never writes 'last read'", async () => {
    const w = mundo();
    w.item("it-1", ANA, "Nubank", "UPDATING");
    await w.registrar(ANA, "it-1");
    expect(Object.keys(w.m.gravacoes[0] ?? {}).sort()).toEqual(["institution_logo", "institution_name", "item_id", "status", "updated_at", "user_id"]);
    expect(w.linhaDe("it-1")?.last_synced_at).toBeNull(); // connected, not read yet
    expect(w.m.leituras).toHaveLength(0);
  });
  it("after a real read, 'last read' is the time of that read and the stamp is Pluggy's", async () => {
    const w = mundo();
    w.item("it-1", ANA, "Nubank", "UPDATED");
    w.m.carimbo = "2026-11-12T11:58:03.000Z";
    await w.registrar(ANA, "it-1");
    const l = w.linhaDe("it-1");
    expect(l?.leitura_ok_em).toBe("2026-11-12T11:58:03.000Z");
    expect(Date.parse(l?.last_synced_at ?? "")).toBeGreaterThan(Date.parse(w.m.gravacoes[0]?.updated_at ?? ""));
  });
  it("a read with no stamp leaves the previous stamp alone", async () => {
    const w = mundo();
    w.linha("con-1", ANA, "it-1", "Nubank", "UPDATED", { leitura_ok_em: "2026-11-11T20:00:00.000Z" });
    w.item("it-1", ANA, "Nubank", "UPDATED");
    await w.registrar(ANA, "it-1");
    expect(w.linhaDe("it-1")?.leitura_ok_em).toBe("2026-11-11T20:00:00.000Z");
  });
  it("reauthorising a bank that is not readable yet keeps the previous 'last read'", async () => {
    const w = mundo();
    w.linha("con-1", ANA, "it-1", "Nubank", "LOGIN_ERROR");
    w.item("it-1", ANA, "Nubank", "UPDATING");
    await w.registrar(ANA, "it-1");
    expect(w.linhaDe("it-1")).toMatchObject({ status: "UPDATING", last_synced_at: "2026-11-10T09:00:00.000Z" });
  });
  it("a failed first import keeps the connection, does not write 'last read', still reads the accounts", async () => {
    const w = mundo();
    w.item("it-1", ANA, "Nubank", "UPDATED");
    w.m.falhaAoImportar = true;
    expect((await w.registrar(ANA, "it-1")).corpo).toMatchObject({ ok: true, entradas: 0, verificado: true });
    expect(w.linhaDe("it-1")?.last_synced_at).toBeNull();
    expect(w.m.contas).toHaveLength(1);
    expect(w.m.avisos).toContain("pluggy-item: importar falhou");
  });
});

describe("A4 — distinct accounts of the same institution are never deleted by the bank's name", () => {
  it("personal + business at the same bank, plan with two slots: both stay, nothing is deleted", async () => {
    const w = mundo();
    w.m.limite.set(ANA, 2);
    const pf = w.linha("con-pf", ANA, "it-pf", "Nubank");
    w.item("it-pj", ANA, "Nubank");
    expect((await w.registrar(ANA, "it-pj")).corpo).toMatchObject({ ok: true, banco: "Nubank" });
    expect(w.m.apagadosNaPluggy).toHaveLength(0);
    expect(pf).toMatchObject({ id: "con-pf", status: "UPDATED", item_id: "it-pf" });
    expect(w.m.linhas.filter((l) => l.status !== "deleted").map((l) => l.item_id).sort()).toEqual(["it-pf", "it-pj"]);
  });
  it("same bank again past the plan's limit: the NEW Item is refused; the connected one is untouched", async () => {
    const w = mundo(); // limit 1
    const antiga = w.linha("con-1", ANA, "it-velho", "Nubank", "LOGIN_ERROR");
    w.item("it-novo", ANA, "Nubank");
    expect(await w.registrar(ANA, "it-novo")).toEqual({ corpo: { error: "precisa_banco_extra" }, http: 200 });
    expect(w.m.apagadosNaPluggy).toEqual(["it-novo"]); // the limit is known and exceeded
    expect(antiga).toMatchObject({ status: "LOGIN_ERROR", item_id: "it-velho" });
    expect(w.m.linhas).toHaveLength(1);
  });
  it("an exempt seller connecting the same bank three times keeps the three", async () => {
    const w = mundo();
    w.m.limite.set(ANA, null);
    for (const it of ["it-1", "it-2", "it-3"]) {
      w.item(it, ANA, "Mercado Pago");
      expect((await w.registrar(ANA, it)).corpo).toMatchObject({ ok: true });
    }
    expect(w.m.linhas.filter((l) => l.status !== "deleted")).toHaveLength(3);
    expect(w.m.apagadosNaPluggy).toHaveLength(0);
  });
  it("one widget session leaving several Items behind (Pro monthly): only the first is registered", async () => {
    const w = mundo(); // limit 1
    for (const it of ["it-1", "it-2", "it-3", "it-4"]) w.item(it, ANA, "Mercado Pago");
    const respostas = [];
    for (const it of ["it-1", "it-2", "it-3", "it-4"]) respostas.push((await w.registrar(ANA, it)).corpo);
    expect(respostas.map((r) => r.ok === true ? "ok" : r.error)).toEqual(["ok", "precisa_banco_extra", "precisa_banco_extra", "precisa_banco_extra"]);
    expect(w.m.linhas).toHaveLength(1);
    expect(w.m.apagadosNaPluggy).toEqual(["it-2", "it-3", "it-4"]);
  });
  it("reauthorising one of two accounts of the same bank touches only that one", async () => {
    const w = mundo();
    w.m.limite.set(ANA, 2);
    const pf = w.linha("con-pf", ANA, "it-pf", "Nubank");
    w.linha("con-pj", ANA, "it-pj", "Nubank", "USER_INPUT_TIMEOUT");
    w.item("it-pj", ANA, "Nubank", "UPDATED");
    expect((await w.registrar(ANA, "it-pj")).corpo).toMatchObject({ ok: true, status: "UPDATED" });
    expect(pf.status).toBe("UPDATED");
    expect(w.linhaDe("it-pj")).toMatchObject({ id: "con-pj", status: "UPDATED" });
    expect(w.m.apagadosNaPluggy).toHaveLength(0);
  });
});

describe("donoDoItem / estadoParaGravar (pure rules)", () => {
  const minha: Linha = { id: "c", user_id: ANA, status: "UPDATED", leitura_ok_em: null };
  it("ownership table", () => {
    expect(donoDoItem({ uid: ANA, clientUserId: ANA, existente: null })).toEqual({ ok: true, nova: true });
    expect(donoDoItem({ uid: ANA, clientUserId: ANA, existente: minha })).toEqual({ ok: true, nova: false });
    expect(donoDoItem({ uid: ANA, clientUserId: ANA, existente: { ...minha, status: "deleted" } })).toEqual({ ok: true, nova: true });
    expect(donoDoItem({ uid: ANA, clientUserId: undefined, existente: minha })).toEqual({ ok: true, nova: false });
    expect(donoDoItem({ uid: ANA, clientUserId: undefined, existente: null })).toEqual({ ok: false });
    expect(donoDoItem({ uid: ANA, clientUserId: BIA, existente: null })).toEqual({ ok: false });
    expect(donoDoItem({ uid: ANA, clientUserId: ANA, existente: { ...minha, user_id: BIA } })).toEqual({ ok: false });
  });
  it("state table", () => {
    expect(estadoParaGravar({ status: "OUTDATED" }, minha)).toBe("OUTDATED");
    expect(estadoParaGravar({ status: " UPDATED " }, null)).toBe("UPDATED");
    expect(estadoParaGravar({ status: null }, null)).toBe("UPDATING");
    expect(estadoParaGravar({ status: "" }, { ...minha, status: "WAITING_USER_INPUT" })).toBe("WAITING_USER_INPUT");
    expect(estadoParaGravar({}, { ...minha, status: "deleted" })).toBe("UPDATING");
    // A3: the seller's pending action is what gets stored
    expect(estadoParaGravar({ status: "OUTDATED", executionStatus: "USER_INPUT_TIMEOUT" }, minha)).toBe("USER_INPUT_TIMEOUT");
    expect(estadoParaGravar({ status: "UPDATED", executionStatus: "PARTIAL_SUCCESS" }, minha)).toBe("UPDATED");
  });
});
