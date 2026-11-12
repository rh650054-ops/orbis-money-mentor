// A-PR2 — the provider's events are recorded (shadow): what is stored, what never is, and that
// recording can fail without touching the webhook.
import { describe, expect, it } from "vitest";
import {
  abrirRegistro, consultaDoItem, corteSemVendedor, fechamentoDoEvento, fecharRegistro, horaDeLimpar,
  horaDoProvedor, itemConsultado, limparVencidos, linhaDoEvento, resultadoDe,
  TAMANHO_MAXIMO_DO_EVENTO, VALIDADE_SEM_VENDEDOR_DIAS,
  type FechamentoDoEvento, type LinhaDoEvento, type PortasDosEventos,
} from "../../supabase/functions/pluggy-webhook/eventos";

const UID = "11111111-1111-1111-1111-111111111111";
const ITEM = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EV = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
// the shapes Pluggy really sends (keys taken from the production logs of 12/11/2026; made-up values)
const itemUpdated = { event: "item/updated", id: ITEM, eventId: EV, itemId: ITEM, clientId: "nosso-app", clientUserId: UID };
const transacoes = {
  event: "transactions/created", eventId: EV, itemId: ITEM, clientId: "nosso-app", accountId: "conta-1",
  transactionsMinDate: "2026-11-12T03:00:00.000Z", createdTransactionsLink: "https://api.pluggy.ai/transactions?x=1",
};
const conector = { event: "connector/status_updated", id: "218", eventId: EV, clientId: "nosso-app", connectorId: "218", data: { status: "UNSTABLE" } };
// an Item as Pluggy returns it, including the fields that must never be stored
const itemDaPluggy = {
  id: ITEM, status: "OUTDATED", executionStatus: "USER_INPUT_TIMEOUT",
  error: { code: "USER_INPUT_TIMEOUT", message: "User requested input had expired", parameter: "oauthCode" },
  statusDetail: { transactions: { isUpdated: false, lastUpdatedAt: "2026-11-10T10:00:00.000Z" } },
  createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-11-12T15:05:00.000Z", lastUpdatedAt: "2026-11-10T10:00:00.000Z",
  consentExpiresAt: null, connector: { id: 612, name: "Nubank", imageUrl: "https://logo", credentials: [{ name: "cpf" }] },
  clientUserId: UID, webhookUrl: "https://x.supabase.co/functions/v1/pluggy-webhook?secret=NAO-PODE-SER-GUARDADO",
  parameter: { name: "token", data: "123456" }, userAction: { instructions: "abra o app" },
};

/** A fake of_eventos with the same two rules the real table has: ids in sequence, one row per provider event id. */
function tabela(o: { inserirFalha?: boolean; fecharFalha?: boolean; lanca?: boolean } = {}) {
  type Linha = LinhaDoEvento & Partial<Omit<FechamentoDoEvento, "user_id" | "bruto">> & { id: number; user_id: string | null; chegou_em: string };
  const linhas: Linha[] = [];
  const logs: { nivel: string; texto: string; dados?: Record<string, unknown> }[] = [];
  let agora = "2026-11-12T20:00:00.000Z";
  const portas: PortasDosEventos = {
    inserir: async (l) => {
      if (o.lanca) throw new Error("rede");
      if (o.inserirFalha) return null;
      if (l.evento_id && linhas.some((x) => x.provedor === l.provedor && x.evento_id === l.evento_id)) return "repetido";
      linhas.push({ ...l, id: linhas.length + 1, user_id: null, chegou_em: agora });
      return linhas.length;
    },
    fechar: async (id, campos) => {
      if (o.lanca) throw new Error("rede");
      const l = linhas.find((x) => x.id === id);
      if (!l || o.fecharFalha) return false;
      Object.assign(l, campos);
      return true;
    },
    limparSemVendedor: async (antesDe) => {
      if (o.lanca) throw new Error("rede");
      const vao = linhas.filter((x) => !x.user_id && x.chegou_em < antesDe);
      for (const v of vao) linhas.splice(linhas.indexOf(v), 1);
      return vao.length;
    },
    registrar: (nivel, texto, dados) => { logs.push({ nivel, texto, dados }); },
  };
  return { portas, linhas, logs, em: (iso: string) => { agora = iso; } };
}

describe("A-PR2 — what is stored of an event", () => {
  it("keeps the event as received, with its identifier, Item and type", () => {
    expect(linhaDoEvento(itemUpdated)).toEqual({
      provedor: "pluggy", evento_id: EV, item_id: ITEM, tipo: "item/updated",
      bruto: { evento: { event: "item/updated", id: ITEM, eventId: EV, itemId: ITEM, clientUserId: UID } },
    });
    expect(linhaDoEvento(transacoes).bruto.evento).toMatchObject({ accountId: "conta-1", transactionsMinDate: "2026-11-12T03:00:00.000Z" });
  });
  it("never stores our own application id (clientId)", () => {
    for (const p of [itemUpdated, transacoes, conector]) expect(JSON.stringify(linhaDoEvento(p))).not.toContain("nosso-app");
  });
  it("an event with no Item (the bank's status) is stored too, with no Item", () => {
    expect(linhaDoEvento(conector)).toMatchObject({ evento_id: EV, item_id: null, tipo: "connector/status_updated" });
  });
  it("whatever arrives is storable: no event id, no type, not even an object", () => {
    expect(linhaDoEvento({ event: "item/updated", itemId: ITEM })).toMatchObject({ evento_id: null, item_id: ITEM });
    expect(linhaDoEvento({ item: { id: ITEM } }).item_id).toBe(ITEM);
    for (const lixo of [null, undefined, "texto", 7, [], [1, 2]]) {
      expect(linhaDoEvento(lixo)).toEqual({ provedor: "pluggy", evento_id: null, item_id: null, tipo: null, bruto: { evento: {} } });
    }
    expect(linhaDoEvento({ event: "  ", eventId: 12, itemId: "" })).toMatchObject({ evento_id: null, item_id: null, tipo: null });
  });
  it("a huge event (thousands of transaction ids) is stored cut, saying so", () => {
    const enorme = { ...transacoes, event: "transactions/deleted", transactionIds: Array.from({ length: 4000 }, (_, i) => `${EV}-${i}`) };
    const l = linhaDoEvento(enorme);
    expect(l.bruto.evento).toMatchObject({ event: "transactions/deleted", eventId: EV, itemId: ITEM, cortado: true });
    expect(JSON.stringify(l).length).toBeLessThan(500);
    expect(Number((l.bruto.evento as { tamanho: number }).tamanho)).toBeGreaterThan(TAMANHO_MAXIMO_DO_EVENTO);
  });
});

describe("A-PR2 — what is stored of the consulted Item", () => {
  it("a fixed list of fields: state, execution, error code, dates, connector, per-product detail", () => {
    expect(itemConsultado(itemDaPluggy)).toEqual({
      status: "OUTDATED", executionStatus: "USER_INPUT_TIMEOUT", erro: "USER_INPUT_TIMEOUT",
      statusDetail: { transactions: { isUpdated: false, lastUpdatedAt: "2026-11-10T10:00:00.000Z" } },
      createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-11-12T15:05:00.000Z", lastUpdatedAt: "2026-11-10T10:00:00.000Z",
      consentExpiresAt: null, conector: { id: 612, name: "Nubank" },
    });
  });
  it("never the webhook address (it carries the secret), the parameter, the credentials, the error text or the bank instructions", () => {
    const guardado = JSON.stringify(fechamentoDoEvento(linhaDoEvento(transacoes), { userId: UID, item: itemDaPluggy }, "lido"));
    for (const proibido of ["NAO-PODE-SER-GUARDADO", "webhookUrl", "secret=", "123456", "parameter", "credentials", "instructions", "User requested"]) {
      expect(guardado).not.toContain(proibido);
    }
  });
  it("a status never seen is kept exactly as it came (raw), not turned into anything else", () => {
    expect(itemConsultado({ status: "ALGO_NOVO", executionStatus: "OUTRA_COISA", error: { code: "CODIGO_NOVO" } }))
      .toMatchObject({ status: "ALGO_NOVO", executionStatus: "OUTRA_COISA", erro: "CODIGO_NOVO" });
  });
  it("no Item, or something that is not an Item: nothing", () => {
    for (const x of [null, undefined, "x", 3, []]) expect(itemConsultado(x)).toBeNull();
  });
  it("the provider's time is the Item's own update time, and only when it is a real date", () => {
    expect(horaDoProvedor(itemDaPluggy)).toBe("2026-11-12T15:05:00.000Z");
    expect(horaDoProvedor({ lastUpdatedAt: "2026-11-10T10:00:00Z" })).toBe("2026-11-10T10:00:00.000Z");
    expect(horaDoProvedor({ updatedAt: "ontem", lastUpdatedAt: "2026-11-10T10:00:00Z" })).toBe("2026-11-10T10:00:00.000Z");
    for (const x of [null, {}, { updatedAt: "" }, { updatedAt: 5 }, { updatedAt: "nao-e-data" }]) expect(horaDoProvedor(x)).toBeUndefined();
  });
});

describe("A-PR2 — how the record is closed", () => {
  const linha = linhaDoEvento(itemUpdated);
  it("with the vendor, the provider's time, the consulted state and what was done", () => {
    expect(fechamentoDoEvento(linha, { userId: UID, item: itemDaPluggy, httpDaConsulta: 200 }, "sem_extrato")).toEqual({
      user_id: UID, provedor_em: "2026-11-12T15:05:00.000Z", resultado: "sem_extrato",
      bruto: { evento: linha.bruto.evento, consulta: "ok", consultado: itemConsultado(itemDaPluggy) },
    });
  });
  it("a consultation that failed is recorded as failed; an Item that no longer exists, as such; one never made, as not made", () => {
    expect(consultaDoItem({})).toBe("nao_feita");
    expect(consultaDoItem({ item: null })).toBe("falhou");
    expect(consultaDoItem({ item: null, httpDaConsulta: 500 })).toBe("falhou");
    expect(consultaDoItem({ item: null, httpDaConsulta: 404 })).toBe("item_nao_existe");
    expect(consultaDoItem({ item: itemDaPluggy, httpDaConsulta: 200 })).toBe("ok");
    const f = fechamentoDoEvento(linha, { userId: UID, item: null, httpDaConsulta: 500 }, "erro");
    expect(f.bruto).toMatchObject({ consulta: "falhou", consultado: null });
    expect(f.provedor_em).toBeUndefined();
  });
  it("no known vendor: user_id is not written (the row stays vendor-less and will expire)", () => {
    for (const userId of [undefined, null, "", "  "]) {
      expect("user_id" in fechamentoDoEvento(linha, { userId, item: itemDaPluggy }, "recusa:sem_vaga")).toBe(false);
    }
  });
  it("names every way the webhook answers today", () => {
    expect(resultadoDe({ ignorado: "connector/status_updated" })).toBe("ignorado");
    expect(resultadoDe({ adiado: "conexao_nao_consultada" })).toBe("adiado:conexao_nao_consultada");
    expect(resultadoDe({ adiado: "limite_indisponivel" }, "recusa:limite_indisponivel")).toBe("recusa:limite_indisponivel");
    expect(resultadoDe({ removida: true })).toBe("conexao_removida");
    expect(resultadoDe({ status: "OUTDATED", sem_extrato: true })).toBe("sem_extrato");
    expect(resultadoDe({ status: "UPDATED", pausado: true })).toBe("pausado");
    expect(resultadoDe({ gravadas: 0 })).toBe("lido");
    expect(resultadoDe({ gravadas: 12 })).toBe("lido");
    expect(resultadoDe({}, "sem_evento_ou_item")).toBe("sem_evento_ou_item");
    expect(resultadoDe({}, "pluggy_sem_chave")).toBe("pluggy_sem_chave");
    expect(resultadoDe({}, "erro")).toBe("erro");
    expect(resultadoDe({})).toBe("sem_tratamento");
    expect(resultadoDe(null)).toBe("sem_tratamento");
  });
});

describe("A-PR2 — recording never gets in the webhook's way", () => {
  it("opens and closes one row per event", async () => {
    const t = tabela();
    const aberto = await abrirRegistro(t.portas, itemUpdated);
    expect(aberto.id).toBe(1);
    expect(t.linhas[0]).toMatchObject({ evento_id: EV, item_id: ITEM, tipo: "item/updated", user_id: null });
    await fecharRegistro(t.portas, aberto, { userId: UID, item: itemDaPluggy, httpDaConsulta: 200 }, "sem_extrato");
    expect(t.linhas).toHaveLength(1);
    expect(t.linhas[0]).toMatchObject({ user_id: UID, resultado: "sem_extrato", provedor_em: "2026-11-12T15:05:00.000Z" });
    expect(t.logs).toEqual([]);
  });
  it("the same event delivered twice is stored once; the second delivery is only noticed", async () => {
    const t = tabela();
    const primeiro = await abrirRegistro(t.portas, itemUpdated);
    await fecharRegistro(t.portas, primeiro, { userId: UID, item: itemDaPluggy }, "lido");
    const segundo = await abrirRegistro(t.portas, itemUpdated);
    expect(segundo.id).toBeNull();
    await fecharRegistro(t.portas, segundo, { userId: UID, item: null }, "erro"); // must not touch the first row
    expect(t.linhas).toHaveLength(1);
    expect(t.linhas[0]?.resultado).toBe("lido");
    expect(t.logs).toEqual([{ nivel: "info", texto: "pluggy-webhook: evento repetido, ja registrado", dados: { tipo: "item/updated" } }]);
  });
  it("events with no provider id are never taken for repeats", async () => {
    const t = tabela();
    await abrirRegistro(t.portas, { event: "item/updated", itemId: ITEM });
    await abrirRegistro(t.portas, { event: "item/updated", itemId: ITEM });
    expect(t.linhas).toHaveLength(2);
  });
  it("the table refusing, or the network failing, never throws: the event is simply not recorded", async () => {
    for (const o of [{ inserirFalha: true }, { lanca: true }]) {
      const t = tabela(o);
      const aberto = await abrirRegistro(t.portas, itemUpdated);
      expect(aberto.id).toBeNull();
      await expect(fecharRegistro(t.portas, aberto, { userId: UID }, "lido")).resolves.toBeUndefined();
      expect(t.logs).toEqual([{ nivel: "erro", texto: "pluggy-webhook: evento nao registrado", dados: { tipo: "item/updated" } }]);
    }
  });
  it("a failure to close is logged and swallowed", async () => {
    const t = tabela({ fecharFalha: true });
    const aberto = await abrirRegistro(t.portas, itemUpdated);
    await expect(fecharRegistro(t.portas, aberto, { userId: UID }, "lido")).resolves.toBeUndefined();
    expect(t.logs).toEqual([{ nivel: "erro", texto: "pluggy-webhook: registro do evento nao foi completado", dados: { tipo: "item/updated" } }]);
    expect(t.linhas[0]?.user_id).toBeNull();
  });
  it("no log line carries an identifier: only the event type or a count", async () => {
    const t = tabela({ fecharFalha: true });
    const a = await abrirRegistro(t.portas, itemUpdated);
    await fecharRegistro(t.portas, a, { userId: UID }, "lido");
    await abrirRegistro(t.portas, itemUpdated);
    const tudo = JSON.stringify(t.logs);
    for (const id of [UID, ITEM, EV]) expect(tudo).not.toContain(id);
  });
});

describe("A-PR2 — events with no vendor expire", () => {
  it(`after ${VALIDADE_SEM_VENDEDOR_DIAS} days, and only those: an event tied to a vendor is never deleted here`, async () => {
    const t = tabela();
    t.em("2026-11-01T10:00:00.000Z");
    const antigoSemDono = await abrirRegistro(t.portas, { ...conector, eventId: "ev-1" });
    const antigoComDono = await abrirRegistro(t.portas, { ...itemUpdated, eventId: "ev-2" });
    await fecharRegistro(t.portas, antigoComDono, { userId: UID, item: itemDaPluggy }, "lido");
    t.em("2026-11-10T10:00:00.000Z");
    const novoSemDono = await abrirRegistro(t.portas, { ...conector, eventId: "ev-3" });
    await limparVencidos(t.portas, new Date("2026-11-12T20:00:00.000Z"));
    expect(t.linhas.map((l) => l.id)).toEqual([antigoComDono.id, novoSemDono.id]);
    expect(antigoSemDono.id).toBe(1);
    expect(t.logs).toEqual([{ nivel: "info", texto: "pluggy-webhook: eventos sem vendedor vencidos, apagados", dados: { quantos: 1 } }]);
  });
  it("the cut is exactly the validity before now", () => {
    expect(corteSemVendedor(new Date("2026-11-12T20:00:00.000Z"))).toBe("2026-11-05T20:00:00.000Z");
  });
  it("looked for at most once an hour, and a failure there is swallowed", async () => {
    const h = 60 * 60 * 1000;
    expect(horaDeLimpar(1_000_000, 0)).toBe(true);
    expect(horaDeLimpar(1_000_000 + h - 1, 1_000_000)).toBe(false);
    expect(horaDeLimpar(1_000_000 + h, 1_000_000)).toBe(true);
    const t = tabela({ lanca: true });
    await expect(limparVencidos(t.portas, new Date())).resolves.toBeUndefined();
    expect(t.logs).toEqual([{ nivel: "erro", texto: "pluggy-webhook: limpeza dos eventos sem vendedor falhou", dados: undefined }]);
  });
});
