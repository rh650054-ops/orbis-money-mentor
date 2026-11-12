// A-PR2 — the provider's events are recorded (shadow): what is stored is chosen field by field,
// what is not chosen never is, and recording can fail without touching the webhook.
import { describe, expect, it } from "vitest";
import {
  abrirRegistro, consultaDoItem, corteSemVendedor, detalheSelecionado, eventoParaOLog, eventoSelecionado,
  fechamentoDoEvento, fecharRegistro, horaDeLimpar, itemConsultado, limparVencidos, linhaDoEvento, resultadoDe,
  PRODUTOS_DO_DETALHE, VALIDADE_SEM_VENDEDOR_DIAS,
  type FechamentoDoEvento, type LinhaDoEvento, type PortasDosEventos,
} from "../../supabase/functions/pluggy-webhook/eventos";

const UID = "11111111-1111-1111-1111-111111111111";
const ITEM = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EV = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const CONTA = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const TX = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const APP = "99999999-9999-9999-9999-999999999999"; // our own application id at Pluggy
// the shapes Pluggy really sends (keys from its documentation and from production logs; made-up values)
const itemUpdated = { event: "item/updated", id: ITEM, eventId: EV, itemId: ITEM, clientId: APP, clientUserId: UID, triggeredBy: "SYNC" };
const itemError = {
  event: "item/error", id: ITEM, eventId: EV, itemId: ITEM, clientId: APP, clientUserId: UID, triggeredBy: "USER",
  error: { code: "USER_INPUT_TIMEOUT", message: "User requested input had expired", parameter: "oauthCode" },
};
const transacoes = {
  event: "transactions/deleted", eventId: EV, itemId: ITEM, clientId: APP, accountId: CONTA,
  transactionIds: [TX, `${TX}-2`, `${TX}-3`], transactionsMinDate: "2026-11-12T03:00:00.000Z",
  createdTransactionsLink: `https://api.pluggy.ai/transactions?accountId=${CONTA}`,
};
const conector = { event: "connector/status_updated", id: "218", eventId: EV, clientId: APP, connectorId: "218", data: { status: "UNSTABLE" } };
// an Item as Pluggy returns it, including what must never be stored
const itemDaPluggy = {
  id: ITEM, status: "OUTDATED", executionStatus: "USER_INPUT_TIMEOUT",
  error: { code: "USER_INPUT_TIMEOUT", message: "User requested input had expired", parameter: "oauthCode" },
  statusDetail: {
    transactions: { isUpdated: false, lastUpdatedAt: "2026-11-10T10:00:00.000Z", warnings: ["conta 12345-6 sem movimento"] },
    accounts: { isUpdated: true, lastUpdatedAt: "2026-11-12T15:00:00.000Z", warnings: [] },
    identity: { isUpdated: true, lastUpdatedAt: "2026-11-12T15:00:00.000Z", fullName: "FULANO DE TAL", document: "12345678901" },
    produtoQueNaoConhecemos: { isUpdated: true, segredo: "x" },
  },
  createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-11-12T15:05:00.000Z", lastUpdatedAt: "2026-11-10T10:00:00.000Z",
  consentExpiresAt: null, connector: { id: 612, name: "Nubank", imageUrl: "https://logo", credentials: [{ name: "cpf" }] },
  clientUserId: UID, webhookUrl: "https://x.supabase.co/functions/v1/pluggy-webhook?secret=NAO-PODE-SER-GUARDADO",
  parameter: { name: "token", data: "123456" }, userAction: { instructions: "abra o app" },
};

const VENENO = "VENENO-NAO-PODE-APARECER";
/** Puts the marker in every leaf of a value, keeping its shape. */
function envenenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(envenenar);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, envenenar(x)]));
  return VENENO;
}

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

describe("A-PR2 — the event: only the chosen fields", () => {
  it("an Item event keeps its type, its id, the Item and who triggered it — nothing else", () => {
    expect(linhaDoEvento(itemUpdated)).toEqual({
      provedor: "pluggy", evento_id: EV, item_id: ITEM, tipo: "item/updated",
      bruto: { evento: {
        event: "item/updated", eventId: EV, itemId: ITEM, triggeredBy: "SYNC",
        erro: null, connectorId: null, statusDoConector: null, transacoes: null,
      } },
    });
  });
  it("an error event keeps the error code, never its message or parameter", () => {
    const l = linhaDoEvento(itemError);
    expect(l.bruto.evento).toMatchObject({ event: "item/error", erro: "USER_INPUT_TIMEOUT", triggeredBy: "USER" });
    const texto = JSON.stringify(l);
    for (const x of ["User requested", "oauthCode", "message", "parameter"]) expect(texto).not.toContain(x);
  });
  it("a transactions event keeps HOW MANY transactions it lists, never which, nor the account, nor the link", () => {
    const l = linhaDoEvento(transacoes);
    expect(l.bruto.evento).toMatchObject({ event: "transactions/deleted", eventId: EV, itemId: ITEM, transacoes: 3 });
    const texto = JSON.stringify(l);
    for (const x of [CONTA, TX, "api.pluggy.ai", "accountId", "transactionIds", "transactionsMinDate"]) expect(texto).not.toContain(x);
  });
  it("a bank-status event (no Item) keeps the connector and its status", () => {
    expect(linhaDoEvento(conector)).toMatchObject({
      evento_id: EV, item_id: null, tipo: "connector/status_updated",
      bruto: { evento: { connectorId: "218", statusDoConector: "UNSTABLE", itemId: null } },
    });
  });
  it("never our application id, nor the vendor id the provider sends in the event", () => {
    for (const p of [itemUpdated, itemError, transacoes, conector]) {
      const texto = JSON.stringify(linhaDoEvento(p));
      expect(texto).not.toContain(APP);
      expect(texto).not.toContain(UID);
      expect(texto).not.toContain("clientId");
      expect(texto).not.toContain("clientUserId");
    }
  });
  it("a field the provider adds later, at any depth, is not stored until it is chosen", () => {
    const comNovidades = {
      ...itemError, cpf: "12345678901", holder: { name: "FULANO", document: { type: "CPF", value: "12345678901" } },
      error: { ...itemError.error, details: { account: "12345-6" } }, data: { status: "ONLINE", secret: "abc", nested: { token: "t" } },
      item: { id: ITEM, webhookUrl: "https://x/pluggy-webhook?secret=S", parameter: { data: "9" } },
    };
    const texto = JSON.stringify(linhaDoEvento(comNovidades));
    for (const x of ["12345678901", "FULANO", "12345-6", "abc", "secret", "token", "webhookUrl", "holder", "cpf"]) expect(texto).not.toContain(x);
    expect(eventoSelecionado(comNovidades)).toEqual({
      event: "item/error", eventId: EV, itemId: ITEM, triggeredBy: "USER", erro: "USER_INPUT_TIMEOUT",
      connectorId: null, statusDoConector: "ONLINE", transacoes: null,
    });
  });
  it("a chosen field with the wrong shape is not stored either (text where a code or an id was expected)", () => {
    for (const p of [envenenar(itemError), envenenar(transacoes), envenenar(conector)]) {
      expect(JSON.stringify(linhaDoEvento(p))).not.toContain(VENENO);
    }
    expect(eventoSelecionado({
      event: "item/updated; drop table", eventId: { id: EV }, itemId: `${ITEM} ou 1=1`, triggeredBy: "meu cpf e 123",
      error: { code: "frase com espacos" }, connectorId: ["218"], data: { status: { x: 1 } }, transactionIds: "muitas",
    })).toEqual({
      event: null, eventId: null, itemId: null, triggeredBy: null, erro: null, connectorId: null, statusDoConector: null, transacoes: null,
    });
  });
  it("a code we have never seen is kept exactly as it came (A13)", () => {
    expect(eventoSelecionado({ event: "item/algo_novo", triggeredBy: "ORIGEM_NOVA", error: { code: "CODIGO_NOVO_42" } }))
      .toMatchObject({ event: "item/algo_novo", triggeredBy: "ORIGEM_NOVA", erro: "CODIGO_NOVO_42" });
    // but only what looks like a provider code: a word in small letters, a sentence, a name with an accent are not codes
    expect(eventoSelecionado({ triggeredBy: "fulano", error: { code: "José" } })).toMatchObject({ triggeredBy: null, erro: null });
  });
  it("whatever arrives is storable: not even an object", () => {
    const vazio = { event: null, eventId: null, itemId: null, triggeredBy: null, erro: null, connectorId: null, statusDoConector: null, transacoes: null };
    for (const lixo of [null, undefined, "texto", 7, [], [1, 2]]) {
      expect(linhaDoEvento(lixo)).toEqual({ provedor: "pluggy", evento_id: null, item_id: null, tipo: null, bruto: { evento: vazio } });
    }
    expect(linhaDoEvento({ item: { id: ITEM } }).item_id).toBe(ITEM);
  });
  it("a huge event stays small: thousands of transaction ids become one number", () => {
    const enorme = { ...transacoes, transactionIds: Array.from({ length: 5000 }, (_, i) => `${TX}-${i}`) };
    const l = linhaDoEvento(enorme);
    expect((l.bruto.evento as { transacoes: number }).transacoes).toBe(5000);
    expect(JSON.stringify(l).length).toBeLessThan(400);
  });
});

describe("A-PR2 — the consulted Item: only the chosen fields", () => {
  it("status, execution, error code, dates, connector id, and per known product: up to date, since when, how many warnings", () => {
    expect(itemConsultado(itemDaPluggy)).toEqual({
      status: "OUTDATED", executionStatus: "USER_INPUT_TIMEOUT", erro: "USER_INPUT_TIMEOUT",
      statusDetail: {
        accounts: { isUpdated: true, lastUpdatedAt: "2026-11-12T15:00:00.000Z", avisos: 0 },
        transactions: { isUpdated: false, lastUpdatedAt: "2026-11-10T10:00:00.000Z", avisos: 1 },
        identity: { isUpdated: true, lastUpdatedAt: "2026-11-12T15:00:00.000Z", avisos: 0 },
      },
      createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-11-12T15:05:00.000Z", lastUpdatedAt: "2026-11-10T10:00:00.000Z",
      consentExpiresAt: null, conector: "612",
    });
  });
  it("never the webhook address (it carries the secret), the parameter, credentials, texts, names, documents or the vendor id", () => {
    const guardado = JSON.stringify(fechamentoDoEvento(linhaDoEvento(transacoes), { userId: UID, item: itemDaPluggy, httpDaConsulta: 200 }, "lido").bruto);
    for (const proibido of [
      "NAO-PODE-SER-GUARDADO", "webhookUrl", "secret=", "123456", "parameter", "credentials", "instructions", "User requested",
      "FULANO", "12345678901", "12345-6", "sem movimento", "fullName", "document", "Nubank", "imageUrl", "produtoQueNaoConhecemos", UID,
    ]) expect(guardado).not.toContain(proibido);
  });
  it("the per-product detail is rebuilt, not copied: nested extras and unknown products are left out", () => {
    const d = detalheSelecionado(itemDaPluggy.statusDetail) as Record<string, Record<string, unknown>>;
    expect(Object.keys(d).sort()).toEqual(["accounts", "identity", "transactions"]);
    for (const produto of Object.keys(d)) expect(Object.keys(d[produto] ?? {}).sort()).toEqual(["avisos", "isUpdated", "lastUpdatedAt"]);
    expect(PRODUTOS_DO_DETALHE).toContain("transactions");
    for (const x of [null, undefined, "x", 3, []]) expect(detalheSelecionado(x)).toBeNull();
  });
  it("every chosen field with the wrong shape is dropped, at any depth", () => {
    const texto = JSON.stringify(itemConsultado(envenenar(itemDaPluggy)));
    expect(texto).not.toContain(VENENO);
    expect(itemConsultado({
      status: { texto: "x" }, executionStatus: "com espaco", error: "nao e objeto", createdAt: "ontem", updatedAt: 5,
      lastUpdatedAt: "2026-13-45", consentExpiresAt: "2027-01-01T00:00:00Z", connector: { id: "612; select" },
      statusDetail: { transactions: { isUpdated: "sim", lastUpdatedAt: "agora", warnings: "muitos" }, accounts: "texto" },
    })).toEqual({
      status: null, executionStatus: null, erro: null,
      statusDetail: { transactions: { isUpdated: null, lastUpdatedAt: null, avisos: 0 } },
      createdAt: null, updatedAt: null, lastUpdatedAt: null, consentExpiresAt: "2027-01-01T00:00:00.000Z", conector: null,
    });
  });
  it("a status never seen is kept exactly as it came (A13), not turned into anything else", () => {
    expect(itemConsultado({ status: "ALGO_NOVO", executionStatus: "OUTRA_COISA", error: { code: "CODIGO_NOVO" } }))
      .toMatchObject({ status: "ALGO_NOVO", executionStatus: "OUTRA_COISA", erro: "CODIGO_NOVO" });
  });
  it("no Item, or something that is not an Item: nothing", () => {
    for (const x of [null, undefined, "x", 3, []]) expect(itemConsultado(x)).toBeNull();
  });
});

describe("A-PR2 — how the record is closed", () => {
  const linha = linhaDoEvento(itemUpdated);
  it("with the vendor, how the consultation ended, the chosen fields of the Item and what was done", () => {
    expect(fechamentoDoEvento(linha, { userId: UID, item: itemDaPluggy, httpDaConsulta: 200 }, "sem_extrato")).toEqual({
      user_id: UID, resultado: "sem_extrato",
      bruto: { evento: linha.bruto.evento, consulta: "ok", consultado: itemConsultado(itemDaPluggy) },
    });
  });
  it("the provider's time is never written: the events carry none, and the Item's update time is not the event's", () => {
    for (const nota of [{ userId: UID, item: itemDaPluggy, httpDaConsulta: 200 }, { userId: UID, item: null, httpDaConsulta: 500 }, {}]) {
      for (const p of [itemUpdated, itemError, transacoes, conector]) {
        const f = fechamentoDoEvento(linhaDoEvento(p), nota, "lido");
        expect("provedor_em" in f).toBe(false);
        expect(Object.keys(f).sort()).toEqual(("user_id" in f ? ["bruto", "resultado", "user_id"] : ["bruto", "resultado"]));
      }
    }
    // the Item's own dates stay where they belong: inside the consulted state
    const f = fechamentoDoEvento(linha, { userId: UID, item: itemDaPluggy, httpDaConsulta: 200 }, "lido");
    expect((f.bruto.consultado as { updatedAt: string }).updatedAt).toBe("2026-11-12T15:05:00.000Z");
    // and a transactions event's dates (a range of the DATA, not the time of the event) are not kept at all
    expect(JSON.stringify(linhaDoEvento(transacoes))).not.toContain("2026-11-12T03:00:00");
  });
  it("a consultation that failed is recorded as failed; an Item that no longer exists, as such; one never made, as not made", () => {
    expect(consultaDoItem({})).toBe("nao_feita");
    expect(consultaDoItem({ item: null })).toBe("falhou");
    expect(consultaDoItem({ item: null, httpDaConsulta: 500 })).toBe("falhou");
    expect(consultaDoItem({ item: "texto", httpDaConsulta: 200 })).toBe("falhou");
    expect(consultaDoItem({ item: null, httpDaConsulta: 404 })).toBe("item_nao_existe");
    expect(consultaDoItem({ item: itemDaPluggy, httpDaConsulta: 200 })).toBe("ok");
    expect(fechamentoDoEvento(linha, { userId: UID, item: null, httpDaConsulta: 500 }, "erro").bruto).toMatchObject({ consulta: "falhou", consultado: null });
  });
  it("no known vendor, or something that is not a vendor id: user_id is not written (the row stays vendor-less and expires)", () => {
    for (const userId of [undefined, null, "", "  ", "nao-e-uuid", `${UID} or 1=1`]) {
      expect("user_id" in fechamentoDoEvento(linha, { userId, item: itemDaPluggy }, "recusa:sem_vaga")).toBe(false);
    }
  });
  it("names every way the webhook answers today, and only writes a short code", () => {
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
    for (const r of ["lido", "sem_extrato", "adiado:conexao_nao_consultada", "recusa:limite_indisponivel", "recusa:sem_vaga", "sem_evento_ou_item"]) {
      expect(fechamentoDoEvento(linha, {}, r).resultado).toBe(r);
    }
    expect(fechamentoDoEvento(linha, {}, `adiado:${VENENO} texto livre`).resultado).toBe("sem_tratamento");
  });
});

describe("A-PR2 — what goes to the function log", () => {
  it("technical facts only: the type, whether it has an id and an Item, who triggered it, the error code, a count", () => {
    expect(eventoParaOLog(linhaDoEvento(itemError))).toEqual({
      tipo: "item/error", com_id: true, com_item: true, origem: "USER", erro: "USER_INPUT_TIMEOUT", transacoes: null,
    });
    expect(eventoParaOLog(linhaDoEvento(transacoes))).toMatchObject({ tipo: "transactions/deleted", transacoes: 3 });
    expect(eventoParaOLog(linhaDoEvento(null))).toEqual({ tipo: null, com_id: false, com_item: false, origem: null, erro: null, transacoes: null });
  });
  it("never an identifier, whatever the event carries", () => {
    for (const p of [itemUpdated, itemError, transacoes, conector, envenenar(itemError)]) {
      const texto = JSON.stringify(eventoParaOLog(linhaDoEvento(p)));
      for (const id of [UID, ITEM, EV, CONTA, TX, APP, VENENO, "218"]) expect(texto).not.toContain(id);
    }
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
    expect(t.linhas[0]).toMatchObject({ user_id: UID, resultado: "sem_extrato" });
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
  it("no log line of the recording carries an identifier: only the event type or a count", async () => {
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
    expect(VALIDADE_SEM_VENDEDOR_DIAS).toBe(7);
    const t = tabela();
    t.em("2026-11-01T10:00:00.000Z");
    const antigoSemDono = await abrirRegistro(t.portas, { ...conector, eventId: EV.replace(/e$/, "1") });
    const antigoComDono = await abrirRegistro(t.portas, { ...itemUpdated, eventId: EV.replace(/e$/, "2") });
    await fecharRegistro(t.portas, antigoComDono, { userId: UID, item: itemDaPluggy }, "lido");
    t.em("2026-11-10T10:00:00.000Z");
    const novoSemDono = await abrirRegistro(t.portas, { ...conector, eventId: EV.replace(/e$/, "3") });
    await limparVencidos(t.portas, new Date("2026-11-12T20:00:00.000Z"));
    expect(t.linhas.map((l) => l.id)).toEqual([antigoComDono.id, novoSemDono.id]);
    expect(antigoSemDono.id).toBe(1);
    expect(t.logs).toEqual([{ nivel: "info", texto: "pluggy-webhook: eventos sem vendedor vencidos, apagados", dados: { quantos: 1 } }]);
  });
  it("the cut is exactly the validity before now", () => {
    expect(corteSemVendedor(new Date("2026-11-12T20:00:00.000Z"))).toBe("2026-11-05T20:00:00.000Z");
  });
  it("looked for at most once an hour, only when an event arrives, and a failure there is swallowed", async () => {
    const h = 60 * 60 * 1000;
    expect(horaDeLimpar(1_000_000, 0)).toBe(true);
    expect(horaDeLimpar(1_000_000 + h - 1, 1_000_000)).toBe(false);
    expect(horaDeLimpar(1_000_000 + h, 1_000_000)).toBe(true);
    const t = tabela({ lanca: true });
    await expect(limparVencidos(t.portas, new Date())).resolves.toBeUndefined();
    expect(t.logs).toEqual([{ nivel: "erro", texto: "pluggy-webhook: limpeza dos eventos sem vendedor falhou", dados: undefined }]);
  });
});
