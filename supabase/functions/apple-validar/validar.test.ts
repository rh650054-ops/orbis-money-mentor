// @vitest-environment node
/* apple-validar: the app's word is a claim. Session, real signature check (Apple's library against
   the fictional authority), owner, confirmation with Apple, failures of communication, restore. */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ClienteApple, StatusApple } from "../_shared/apple/api-apple";
import { adulterar, bancoFalso, CONTA_A, CONTA_B, criarCadeia, renovacao, transacao } from "../_shared/apple/cadeia-de-teste";
import { conferirChamada, contratoSql } from "../_shared/apple/contrato-sql";
import { APP_APPLE_ID, BUNDLE_ID } from "../_shared/apple/regras";
import { AssinaturaInvalida, criarVerificador, type Verificador } from "../_shared/apple/verificador";

type Deps = { quemE: (a: string) => Promise<string | null>; verificar: Verificador; apple: ClienteApple | null; db: ReturnType<typeof bancoFalso> };
let tratarValidar: (req: Request, deps: Deps) => Promise<Response>;
const cadeia = criarCadeia();
const verificar = criarVerificador({ raizes: [cadeia.raiz], bundleId: BUNDLE_ID, appAppleId: APP_APPLE_ID, online: false });
const contrato = contratoSql();
const logs: string[] = [];

beforeAll(async () => {
  for (const m of ["log", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(" ")); });
  (globalThis as unknown as { Deno: unknown }).Deno = { env: { get: () => "x" } };
  ({ tratarValidar } = (await import("./index")) as unknown as { tratarValidar: typeof tratarValidar });
});

const logado = (id: string | null) => () => Promise.resolve(id);
const pedido = (corpo: unknown, metodo = "POST") =>
  new Request("https://x.test/apple-validar", { method: metodo, headers: { Authorization: "Bearer sessao-ficticia" }, body: metodo === "POST" ? JSON.stringify(corpo) : undefined });
async function validar(corpo: unknown, o: Partial<Deps> & { conta?: string | null } = {}) {
  const db = o.db ?? bancoFalso();
  const r = await tratarValidar(pedido(corpo), { quemE: o.quemE ?? logado(o.conta === undefined ? CONTA_A : o.conta), verificar: o.verificar ?? verificar, apple: o.apple ?? null, db });
  return { r, corpo: (await r.json()) as { ok?: boolean; error?: string; resultados?: { produto: string | null; resultado: string; confirmada_na_apple: boolean }[]; acesso?: Record<string, unknown> }, db };
}
const apple = (f: (id: string, amb: string) => StatusApple[] | null | Promise<StatusApple[] | null>): ClienteApple & { pedidos: [string, string][] } => {
  const pedidos: [string, string][] = [];
  return { pedidos, status: (id, amb) => { pedidos.push([id, amb]); return Promise.resolve().then(() => f(id, amb)); } };
};

describe("who is asking", () => {
  it("no session: 401 and nothing is read or written", async () => {
    const { r, corpo, db } = await validar({ jws: cadeia.assinar(transacao()) }, { conta: null });
    expect(r.status).toBe(401);
    expect(corpo).toEqual({ error: "nao_autorizado" });
    expect(db.chamadas).toEqual([]);
  });

  it("the account is the one of the session; a user id sent in the body is ignored", async () => {
    const { db } = await validar({ jws: cadeia.assinar(transacao({ appAccountToken: undefined })), user_id: CONTA_B, p_user: CONTA_B, userId: CONTA_B });
    expect(db.de("apple_assinatura_gravar")[0]?.args.p_user).toBe(CONTA_A);
    expect(db.de("vant_direitos")[0]?.args).toEqual({ p_user: CONTA_A });
  });

  it("only POST with one to twenty transactions", async () => {
    for (const corpo of [{}, { transacoes: [] }, { transacoes: [42] }, { transacoes: Array.from({ length: 21 }, (_, i) => `a.b.${i}`) }, { jws: 42 }, null]) {
      const { r, db } = await validar(corpo);
      expect(r.status).toBe(400);
      expect(db.chamadas).toEqual([]);
    }
    const db = bancoFalso();
    expect((await tratarValidar(pedido(null, "GET"), { quemE: logado(CONTA_A), verificar, apple: null, db })).status).toBe(405);
  });
});

describe("the transaction must be Apple's", () => {
  it("a real one is written with what is INSIDE it; the answer says what the account has, read from the server", async () => {
    const t = transacao({ productId: "app.vant.vendas.pro.anual", price: 419900 });
    const { r, corpo, db } = await validar({ jws: cadeia.assinar(t), produto: "app.vant.vendas.essencial.mensal", plano: "pro_anual", preco: 1 },
      { db: bancoFalso({ vant_direitos: [{ direito: "plano", origem: "apple" }, { direito: "pro", origem: "apple" }, { direito: "banco", origem: "hotmart" }] }) });
    expect(r.status).toBe(200);
    expect(corpo).toEqual({ ok: true, resultados: [{ produto: "app.vant.vendas.pro.anual", resultado: "gravada", confirmada_na_apple: false }], acesso: { suspensa: false, plano: true, pro: true, bancos_adicionais: 1 } });
    expect(db.chamadas.map((c) => c.funcao)).toEqual(["apple_assinatura_gravar", "apple_transacao_registrar", "vant_direitos"]);
    expect(db.de("apple_assinatura_gravar")[0]?.args).toMatchObject({ p_user: CONTA_A, p_produto: "app.vant.vendas.pro.anual", p_ambiente: "Sandbox", p_original: t.originalTransactionId, p_conferida: false });
    expect(db.de("apple_transacao_registrar")[0]?.args).toMatchObject({ p_preco_milesimos: 419900 });
    expect(db.chamadas.map((c) => conferirChamada(contrato, c.funcao, c.args)).filter(Boolean)).toEqual([]);
  });

  it("invented, edited, forged, of another authority, of another app: 'assinatura_invalida', and NOTHING is granted or written", async () => {
    // bought by account B; the logged-in account A tries to make it its own
    const boa = cadeia.assinar(transacao({ productId: "app.vant.vendas.essencial.mensal", appAccountToken: CONTA_B }));
    const outra = criarCadeia({ nome: "Impostora" });
    const ruins = [
      adulterar(boa, (p) => { p.productId = "app.vant.vendas.pro.anual"; }),
      adulterar(boa, (p) => { p.expiresDate = Date.now() + 9e11; }),
      adulterar(boa, (p) => { p.appAccountToken = CONTA_A; }),
      cadeia.forjar(transacao()),
      outra.assinar(transacao()),
      cadeia.assinar(transacao({ bundleId: "com.outro.app" })),
      `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(transacao())).toString("base64url")}.`,
      JSON.stringify(transacao()),
      "produto=app.vant.vendas.pro.anual",
    ];
    for (const jws of ruins) {
      const { r, corpo, db } = await validar({ jws });
      expect(r.status).toBe(200);
      expect(corpo.resultados).toEqual([{ produto: null, resultado: "assinatura_invalida", confirmada_na_apple: false }]);
      expect(db.de("apple_assinatura_gravar")).toEqual([]);
      expect(db.de("apple_transacao_registrar")).toEqual([]);
    }
  });

  it("a product that is not ours, or something that is not a subscription: refused before the database", async () => {
    for (const [extra, esperado] of [[{ productId: "app.vant.vendas.pro.vitalicio" }, "produto_desconhecido"], [{ type: "Non-Consumable" }, "nao_e_assinatura"]] as const) {
      const { corpo, db } = await validar({ jws: cadeia.assinar(transacao(extra)) });
      expect(corpo.resultados?.[0]?.resultado).toBe(esperado);
      expect(db.de("apple_assinatura_gravar")).toEqual([]);
    }
  });
});

describe("the owner (reuse of a purchase)", () => {
  it("a purchase Apple signed for ANOTHER VANT account is refused here, with nothing written and Apple not even asked", async () => {
    const a = apple(() => []);
    const { corpo, db } = await validar({ jws: cadeia.assinar(transacao({ appAccountToken: CONTA_A })) }, { conta: CONTA_B, apple: a });
    expect(corpo.resultados).toEqual([{ produto: "app.vant.vendas.pro.mensal", resultado: "pertence_a_outra_conta", confirmada_na_apple: false }]);
    expect(db.de("apple_assinatura_gravar")).toEqual([]);
    expect(db.de("apple_transacao_registrar")).toEqual([]);
    expect(a.pedidos).toEqual([]);
  });

  it("with no account in the signature, the database decides: a subscription that already has an owner is not handed to a second account, and the sale is not recorded twice", async () => {
    const { corpo, db } = await validar({ jws: cadeia.assinar(transacao({ appAccountToken: undefined })) }, { conta: CONTA_B, db: bancoFalso({ apple_assinatura_gravar: "pertence_a_outra_conta" }) });
    expect(corpo.resultados?.[0]?.resultado).toBe("pertence_a_outra_conta");
    expect(db.de("apple_assinatura_gravar")[0]?.args.p_user).toBe(CONTA_B);
    expect(db.de("apple_transacao_registrar")).toEqual([]);
  });

  it("a refunded transaction presented again: the database answers 'reembolsada' and that is what the app gets", async () => {
    const { corpo } = await validar({ jws: cadeia.assinar(transacao()) }, { db: bancoFalso({ apple_assinatura_gravar: "reembolsada" }) });
    expect(corpo.resultados?.[0]?.resultado).toBe("reembolsada");
  });
});

describe("confirmation with Apple and failures of communication", () => {
  const original = "2000000000000100";
  it("when Apple can be asked, what is written is what APPLE answers now (also verified), not the device's copy", async () => {
    const doAparelho = transacao({ expiresDate: Date.now() + 86_400_000, transactionId: "2000000000000101" });
    const fresca = transacao({ expiresDate: Date.now() + 30 * 86_400_000, transactionId: "2000000000000109", signedDate: Date.now() + 1000 });
    const a = apple(() => [{ original: "2000000000000999", status: 1, transacao: cadeia.assinar(transacao({ originalTransactionId: "2000000000000999" })), renovacao: null },
      { original, status: 1, transacao: cadeia.assinar(fresca), renovacao: cadeia.assinar(renovacao({ autoRenewStatus: 0 })) }]);
    const { corpo, db } = await validar({ jws: cadeia.assinar(doAparelho) }, { apple: a });
    expect(a.pedidos).toEqual([[original, "Sandbox"]]);
    expect(corpo.resultados?.[0]).toMatchObject({ resultado: "gravada", confirmada_na_apple: true });
    expect(db.de("apple_assinatura_gravar")[0]?.args).toMatchObject({ p_transacao: "2000000000000109", p_expira: new Date(fresca.expiresDate as number).toISOString(), p_renova: false, p_conferida: true });
  });

  it("Apple reports it REFUNDED although the device's copy looks fine: the refund is what gets written", async () => {
    const quando = Date.now() - 1000;
    const a = apple(() => [{ original, status: 5, transacao: cadeia.assinar(transacao({ revocationDate: quando, signedDate: Date.now() + 1000 })), renovacao: null }]);
    const { db } = await validar({ jws: cadeia.assinar(transacao()) }, { apple: a });
    expect(db.de("apple_assinatura_gravar")[0]?.args).toMatchObject({ p_revogada: new Date(quando).toISOString(), p_conferida: true });
  });

  it("Apple's answer points to another account: refused", async () => {
    const a = apple(() => [{ original, status: 1, transacao: cadeia.assinar(transacao({ appAccountToken: CONTA_B })), renovacao: null }]);
    const { corpo, db } = await validar({ jws: cadeia.assinar(transacao({ appAccountToken: undefined })) }, { apple: a });
    expect(corpo.resultados?.[0]).toMatchObject({ resultado: "pertence_a_outra_conta", confirmada_na_apple: true });
    expect(db.de("apple_assinatura_gravar")).toEqual([]);
  });

  it("FAILURE OF COMMUNICATION (Apple down, timeout, an answer that is not Apple's): the verified copy from the device is used, marked as not confirmed, and the purchase is not lost", async () => {
    const outra = criarCadeia({ nome: "Impostora" });
    const falhas: ClienteApple[] = [
      apple(() => { throw new Error("ETIMEDOUT"); }),
      apple(() => Promise.reject(new Error("apple_api_500"))),
      apple(() => [{ original, status: 1, transacao: outra.assinar(transacao()), renovacao: null }]),
      apple(() => [{ original, status: 1, transacao: "lixo", renovacao: null }]),
    ];
    for (const a of falhas) {
      const { r, corpo, db } = await validar({ jws: cadeia.assinar(transacao()) }, { apple: a });
      expect(r.status).toBe(200);
      expect(corpo.resultados?.[0]).toMatchObject({ resultado: "gravada", confirmada_na_apple: false });
      expect(db.de("apple_assinatura_gravar")[0]?.args).toMatchObject({ p_conferida: false, p_transacao: "2000000000000101" });
    }
  });

  it("Apple does not know the transaction (404) or has no key configured: the same, not confirmed", async () => {
    for (const a of [apple(() => null), apple(() => []), null]) {
      const { corpo, db } = await validar({ jws: cadeia.assinar(transacao()) }, { apple: a });
      expect(corpo.resultados?.[0]).toMatchObject({ resultado: "gravada", confirmada_na_apple: false });
      expect(db.de("apple_assinatura_gravar")[0]?.args.p_conferida).toBe(false);
    }
  });

  it("the revocation service did not answer: 'tente_de_novo' and 503 when it is the only transaction, so the app keeps the purchase open", async () => {
    const instavel: Verificador = { ...verificar, transacao: () => Promise.reject(new AssinaturaInvalida("RETRYABLE_VERIFICATION_FAILURE", true)) };
    const { r, corpo, db } = await validar({ jws: "a.b.c" }, { verificar: instavel });
    expect(r.status).toBe(503);
    expect(corpo).toMatchObject({ ok: false, resultados: [{ resultado: "tente_de_novo" }] });
    expect(db.de("apple_assinatura_gravar")).toEqual([]);
  });

  it("the database fails: 500, a neutral message, and no 'ok' for the app to believe", async () => {
    const { r, corpo } = await validar({ jws: cadeia.assinar(transacao()) }, { db: bancoFalso({ apple_assinatura_gravar: () => { throw new Error("deadlock detected for user fulana@exemplo.com"); } }) });
    expect(r.status).toBe(500);
    expect(corpo).toEqual({ error: "falhou" });
  });
});

describe("restoring purchases", () => {
  it("several transactions at once: each one judged on its own, repeated ones sent once, a bad one does not stop the good ones", async () => {
    const plano = cadeia.assinar(transacao());
    const banco = cadeia.assinar(transacao({ productId: "app.vant.vendas.banco.mensal", originalTransactionId: "2000000000000200", transactionId: "2000000000000201", price: 12900 }));
    const deOutro = cadeia.assinar(transacao({ appAccountToken: CONTA_B, originalTransactionId: "2000000000000300", transactionId: "2000000000000301" }));
    const { r, corpo, db } = await validar({ transacoes: [plano, banco, plano, "lixo.lixo.lixo", deOutro] });
    expect(r.status).toBe(200);
    expect(corpo.resultados?.map((x) => x.resultado)).toEqual(["gravada", "gravada", "assinatura_invalida", "pertence_a_outra_conta"]);
    expect(db.de("apple_assinatura_gravar").map((c) => c.args.p_original)).toEqual(["2000000000000100", "2000000000000200"]);
    expect(db.de("apple_transacao_registrar").map((c) => c.args.p_transacao)).toEqual(["2000000000000101", "2000000000000201"]);
  });

  it("restoring the same purchase again writes the same identifiers (the database keeps one subscription and one sale)", async () => {
    const jws = cadeia.assinar(transacao());
    const db = bancoFalso();
    await validar({ jws }, { db }); await validar({ jws }, { db });
    expect(new Set(db.de("apple_assinatura_gravar").map((c) => `${c.args.p_original}|${c.args.p_transacao}|${c.args.p_assinado}`)).size).toBe(1);
    expect(new Set(db.de("apple_transacao_registrar").map((c) => c.args.p_transacao)).size).toBe(1);
  });
});

describe("logs", () => {
  it("never a JWS, a session token or a payload", async () => {
    logs.length = 0;
    const jws = cadeia.assinar(transacao());
    await validar({ jws });
    await validar({ jws: cadeia.forjar(transacao()) });
    const tudo = logs.join("\n");
    expect(tudo).toContain("apple-validar:");
    expect(tudo).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(tudo).not.toContain("sessao-ficticia");
    expect(tudo).not.toContain("appAccountToken");
  });
});
