// @vitest-environment node
/* apple-webhook: authenticity, idempotency, owner, order and failures. The signature check is the
   real one (Apple's library) against the fictional authority of cadeia-de-teste; the database is a
   stand-in that records every call, and every call is checked against the SQL of the migrations. */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { adulterar, bancoFalso, CONTA_A, criarCadeia, notificacao, renovacao, transacao } from "../_shared/apple/cadeia-de-teste";
import { conferirChamada, contratoSql } from "../_shared/apple/contrato-sql";
import { APP_APPLE_ID, BUNDLE_ID } from "../_shared/apple/regras";
import { AssinaturaInvalida, criarVerificador, type Verificador } from "../_shared/apple/verificador";

type Deps = { verificar: Verificador; db: ReturnType<typeof bancoFalso> };
let tratarWebhook: (req: Request, deps: Deps) => Promise<Response>;
const cadeia = criarCadeia();
const verificar = criarVerificador({ raizes: [cadeia.raiz], bundleId: BUNDLE_ID, appAppleId: APP_APPLE_ID, online: false });
const contrato = contratoSql();
const logs: string[] = [];

beforeAll(async () => {
  for (const m of ["log", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(" ")); });
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => "x" } };
  ({ tratarWebhook } = (await import("./index")) as unknown as { tratarWebhook: typeof tratarWebhook });
});

const pedido = (corpo: unknown, metodo = "POST") => new Request("https://x.test/apple-webhook", { method: metodo, body: metodo === "POST" ? (typeof corpo === "string" ? corpo : JSON.stringify(corpo)) : undefined });
const enviar = async (n: Record<string, unknown>, db = bancoFalso()) => {
  const assinado = cadeia.assinar(n);
  const r = await tratarWebhook(pedido({ signedPayload: assinado }), { verificar, db });
  return { r, corpo: (await r.json()) as Record<string, unknown>, db, assinado };
};
const semProblemaDeContrato = (db: ReturnType<typeof bancoFalso>) => db.chamadas.map((c) => conferirChamada(contrato, c.funcao, c.args)).filter(Boolean);

describe("authenticity", () => {
  it("a real notification is processed: receipt, state, ledger, conclusion, in this order, all within the SQL contract", async () => {
    const t = transacao(), n = notificacao(cadeia, "DID_RENEW", t, renovacao());
    const { r, corpo, db } = await enviar(n);
    expect(r.status).toBe(200);
    expect(corpo).toEqual({ ok: true, resultado: "gravada" });
    expect(db.chamadas.map((c) => c.funcao)).toEqual(["apple_evento_registrar", "apple_assinatura_gravar", "apple_transacao_registrar", "apple_evento_concluir"]);
    expect(semProblemaDeContrato(db)).toEqual([]);
    expect(db.de("apple_evento_registrar")[0]?.args).toMatchObject({ p_uuid: n.notificationUUID, p_tipo: "DID_RENEW", p_ambiente: "Sandbox", p_original: t.originalTransactionId, p_transacao: t.transactionId, p_user: CONTA_A });
    expect(db.de("apple_evento_concluir")[0]?.args).toEqual({ p_uuid: n.notificationUUID, p_resultado: "gravada" });
  });

  it("what is written comes from INSIDE the signed documents: product, end, owner, price", async () => {
    const t = transacao({ productId: "app.vant.vendas.pro.anual", price: 419900, expiresDate: 1_900_000_000_000 });
    const { db } = await enviar(notificacao(cadeia, "SUBSCRIBED", t, renovacao({ autoRenewStatus: 0 }), { signedDate: 1_800_000_000_000 }));
    expect(db.de("apple_assinatura_gravar")[0]?.args).toMatchObject({
      p_user: CONTA_A, p_produto: "app.vant.vendas.pro.anual", p_ambiente: "Sandbox", p_expira: new Date(1_900_000_000_000).toISOString(),
      p_assinado: new Date(1_800_000_000_000).toISOString(), p_renova: false, p_revogada: null, p_conferida: false,
    });
    expect(db.de("apple_transacao_registrar")[0]?.args).toMatchObject({ p_preco_milesimos: 419900, p_moeda: "BRL", p_produto: "app.vant.vendas.pro.anual" });
  });

  it("refused with 401 and NOTHING written: forged, edited, another authority, another app, not a JWS, no body", async () => {
    const boa = cadeia.assinar(notificacao(cadeia, "DID_RENEW", transacao(), null));
    const outra = criarCadeia({ nome: "Impostora" });
    const outroApp = notificacao(cadeia, "DID_RENEW", transacao(), null);
    (outroApp.data as Record<string, unknown>).bundleId = "com.outro.app";
    const tentativas: unknown[] = [
      { signedPayload: cadeia.forjar(notificacao(cadeia, "DID_RENEW", transacao(), null)) },
      { signedPayload: adulterar(boa, (p) => { p.notificationType = "SUBSCRIBED"; }) },
      { signedPayload: outra.assinar(notificacao(outra, "DID_RENEW", transacao(), null)) },
      { signedPayload: cadeia.assinar(outroApp) },
      { signedPayload: "eyJhbGciOiJub25lIn0.eyJub3RpZmljYXRpb25UeXBlIjoiRElEX1JFTkVXIn0." },
      { signedPayload: JSON.stringify({ notificationType: "DID_RENEW", data: { environment: "Sandbox" } }) },
    ];
    for (const corpo of tentativas) {
      const db = bancoFalso();
      const r = await tratarWebhook(pedido(corpo), { verificar, db });
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: "assinatura_invalida" });
      expect(db.chamadas).toEqual([]);
    }
    for (const corpo of [{}, { signedPayload: 42 }, "isto nao e json", { notificationType: "DID_RENEW", notificationUUID: "x" }]) {
      const db = bancoFalso();
      const r = await tratarWebhook(pedido(corpo), { verificar, db });
      expect(r.status).toBe(400);
      expect(db.chamadas).toEqual([]);
    }
    const db = bancoFalso();
    expect((await tratarWebhook(pedido(null, "GET"), { verificar, db })).status).toBe(405);
    expect(db.chamadas).toEqual([]);
  });

  it("a real notification carrying a transaction that is NOT Apple's (or of another environment) is refused whole", async () => {
    const outra = criarCadeia({ nome: "Impostora" });
    const n = notificacao(cadeia, "DID_RENEW", null, null);
    (n.data as Record<string, unknown>).signedTransactionInfo = outra.assinar(transacao());
    const a = await enviar(n);
    expect(a.r.status).toBe(401);
    expect(a.db.chamadas).toEqual([]);
    const misturada = notificacao(cadeia, "DID_RENEW", null, null);
    (misturada.data as Record<string, unknown>).environment = "Production";
    (misturada.data as Record<string, unknown>).signedTransactionInfo = cadeia.assinar(transacao({ environment: "Sandbox" }));
    const b = await enviar(misturada);
    expect(b.r.status).toBe(401);
    expect(b.db.chamadas).toEqual([]);
  });

  it("Apple's revocation service not answering is not a refusal: 503, so Apple sends it again; nothing written", async () => {
    const instavel: Verificador = { ...verificar, notificacao: () => Promise.reject(new AssinaturaInvalida("RETRYABLE_VERIFICATION_FAILURE", true)) };
    const db = bancoFalso();
    const r = await tratarWebhook(pedido({ signedPayload: "x.y.z" }), { verificar: instavel, db });
    expect(r.status).toBe(503);
    expect(db.chamadas).toEqual([]);
  });
});

describe("idempotency and failures", () => {
  it("a notification already concluded: 200, and nothing is applied again", async () => {
    const { r, corpo, db } = await enviar(notificacao(cadeia, "DID_RENEW", transacao(), null), bancoFalso({ apple_evento_registrar: "repetido" }));
    expect(r.status).toBe(200);
    expect(corpo).toEqual({ ok: true, repetido: true });
    expect(db.chamadas.map((c) => c.funcao)).toEqual(["apple_evento_registrar"]);
  });

  it("received before but never concluded (the first attempt failed): processed again, fully", async () => {
    const { r, db } = await enviar(notificacao(cadeia, "DID_RENEW", transacao(), null), bancoFalso({ apple_evento_registrar: "pendente" }));
    expect(r.status).toBe(200);
    expect(db.chamadas.map((c) => c.funcao)).toEqual(["apple_evento_registrar", "apple_assinatura_gravar", "apple_transacao_registrar", "apple_evento_concluir"]);
  });

  it("the database fails while applying: 500 and the notification is NOT concluded, so Apple's retry processes it", async () => {
    for (const quebra of ["apple_assinatura_gravar", "apple_transacao_registrar", "apple_evento_registrar"]) {
      const { r, db } = await enviar(notificacao(cadeia, "DID_RENEW", transacao(), null), bancoFalso({ [quebra]: () => { throw new Error("connection reset by peer"); } }));
      expect(r.status).toBe(500);
      expect(db.de("apple_evento_concluir")).toEqual([]);
    }
  });

  it("the same notification sent twice in a row reaches the database with the same identifier both times (the database keeps it once)", async () => {
    const n = notificacao(cadeia, "DID_RENEW", transacao(), null);
    const db = bancoFalso();
    await enviar(n, db); await enviar(n, db);
    expect(db.de("apple_evento_registrar").map((c) => c.args.p_uuid)).toEqual([n.notificationUUID, n.notificationUUID]);
  });
});

describe("owner, order and kinds of notification", () => {
  it("the owner is the account Apple signed; with no token the database keeps whoever already owns the subscription (p_user null)", async () => {
    const a = await enviar(notificacao(cadeia, "DID_RENEW", transacao(), null));
    expect(a.db.de("apple_assinatura_gravar")[0]?.args.p_user).toBe(CONTA_A);
    for (const token of [undefined, "nao-e-uuid", ""]) {
      const b = await enviar(notificacao(cadeia, "DID_RENEW", transacao({ appAccountToken: token }), null));
      expect(b.db.de("apple_assinatura_gravar")[0]?.args.p_user).toBeNull();
    }
  });

  it("the order is the time Apple signed the NOTIFICATION, passed to the database, which ignores the older one", async () => {
    const quando = Date.now() - 3_600_000;
    const t = transacao({ signedDate: quando - 86_400_000 });
    const { corpo, db } = await enviar(notificacao(cadeia, "DID_RENEW", t, null, { signedDate: quando }), bancoFalso({ apple_assinatura_gravar: "antigo_ignorado" }));
    expect(db.de("apple_assinatura_gravar")[0]?.args.p_assinado).toBe(new Date(quando).toISOString());
    expect(corpo).toEqual({ ok: true, resultado: "antigo_ignorado" });
    expect(db.de("apple_evento_concluir")[0]?.args.p_resultado).toBe("antigo_ignorado");
  });

  it("a refund carries the refund date to the mirror and to the ledger", async () => {
    const quando = Date.now() - 5000;
    const { db } = await enviar(notificacao(cadeia, "REFUND", transacao({ revocationDate: quando, revocationReason: 1 }), null));
    expect(db.de("apple_assinatura_gravar")[0]?.args).toMatchObject({ p_revogada: new Date(quando).toISOString(), p_status: "reembolsada" });
    expect(db.de("apple_transacao_registrar")[0]?.args).toMatchObject({ p_reembolsado: new Date(quando).toISOString(), p_reembolso_motivo: "1" });
  });

  it("auto-renew turned off (DID_CHANGE_RENEWAL_STATUS): the end of the paid period goes unchanged, only the flag is false", async () => {
    const t = transacao();
    const { db } = await enviar(notificacao(cadeia, "DID_CHANGE_RENEWAL_STATUS", t, renovacao({ autoRenewStatus: 0 }), { subtype: "AUTO_RENEW_DISABLED" }));
    expect(db.de("apple_assinatura_gravar")[0]?.args).toMatchObject({ p_renova: false, p_revogada: null, p_expira: new Date(t.expiresDate as number).toISOString() });
  });

  it("billing grace period (DID_FAIL_TO_RENEW / GRACE_PERIOD): the grace end is passed on", async () => {
    const fim = Date.now() - 1000, carencia = Date.now() + 3 * 86_400_000;
    const { db } = await enviar(notificacao(cadeia, "DID_FAIL_TO_RENEW", transacao({ expiresDate: fim }), renovacao({ gracePeriodExpiresDate: carencia, isInBillingRetryPeriod: true }), { subtype: "GRACE_PERIOD" }));
    expect(db.de("apple_assinatura_gravar")[0]?.args).toMatchObject({ p_tolerancia: new Date(carencia).toISOString(), p_status: "em_carencia" });
  });

  it("an upgrade arrives as the same subscription with the new product", async () => {
    const { db } = await enviar(notificacao(cadeia, "DID_CHANGE_RENEWAL_PREF", transacao({ productId: "app.vant.vendas.pro.anual", transactionId: "2000000000000102" }), renovacao({ autoRenewProductId: "app.vant.vendas.pro.anual" }), { subtype: "UPGRADE" }));
    expect(db.de("apple_assinatura_gravar")[0]?.args).toMatchObject({ p_original: "2000000000000100", p_produto: "app.vant.vendas.pro.anual", p_transacao: "2000000000000102" });
  });

  it("TEST, a notification with no transaction, a product that is not ours, something that is not a subscription: recorded and concluded, no access touched", async () => {
    const casos: [Record<string, unknown>, string][] = [
      [notificacao(cadeia, "TEST", null, null), "sem_transacao"],
      [notificacao(cadeia, "TEST", transacao(), null), "sem_transacao"],
      [notificacao(cadeia, "DID_RENEW", transacao({ productId: "app.vant.vendas.pro.vitalicio" }), null), "produto_desconhecido"],
      [notificacao(cadeia, "REFUND", transacao({ type: "Consumable" }), null), "nao_e_assinatura"],
    ];
    for (const [n, esperado] of casos) {
      const { r, corpo, db } = await enviar(n);
      expect(r.status).toBe(200);
      expect(corpo).toEqual({ ok: true, resultado: esperado });
      expect(db.de("apple_assinatura_gravar")).toEqual([]);
      expect(db.de("apple_transacao_registrar")).toEqual([]);
      expect(db.de("apple_evento_concluir")[0]?.args.p_resultado).toBe(esperado);
    }
  });

  it("a Production notification is processed the same way, labelled Production", async () => {
    const { db } = await enviar(notificacao(cadeia, "DID_RENEW", transacao({ environment: "Production", originalTransactionId: "1000000000000100" }), null));
    expect(db.de("apple_assinatura_gravar")[0]?.args.p_ambiente).toBe("Production");
    expect(db.de("apple_evento_registrar")[0]?.args.p_ambiente).toBe("Production");
  });
});

describe("what is stored and logged", () => {
  it("the stored event has the decoded documents and never a signed string; the logs never carry a JWS, a token or the payload", async () => {
    logs.length = 0;
    const { db, assinado } = await enviar(notificacao(cadeia, "DID_RENEW", transacao(), renovacao()));
    const guardado = JSON.stringify(db.de("apple_evento_registrar")[0]?.args.p_payload);
    expect(guardado).toContain('"productId":"app.vant.vendas.pro.mensal"');
    expect(guardado).not.toContain("signedTransactionInfo");
    expect(guardado).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\./);
    const tudo = logs.join("\n");
    expect(tudo).toContain("apple-webhook: event");
    expect(tudo).not.toContain(assinado.slice(0, 40));
    expect(tudo).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(tudo).not.toContain("appAccountToken");
  });
});
