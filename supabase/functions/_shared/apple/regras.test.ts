// @vitest-environment node
/* From what Apple signed to what we store: the pure rules shared by the three Apple functions. */
import { describe, expect, it } from "vitest";
import { ambienteDeclarado, donoPeloToken, espiar, estado, linhaDeLog, linhaFinanceira, PRODUTOS, rotulo, type Estado, type Transacao } from "./regras";

const AGORA = Date.UTC(2026, 10, 27, 12, 0, 0);
const DIA = 86_400_000;
const T: Transacao = {
  bundleId: "app.vant.vendas", environment: "Production", type: "Auto-Renewable Subscription", transactionId: "T2", originalTransactionId: "O1",
  productId: "app.vant.vendas.pro.mensal", purchaseDate: AGORA - DIA, expiresDate: AGORA + 29 * DIA, signedDate: AGORA,
  appAccountToken: "11111111-1111-4111-8111-111111111111", price: 49900, currency: "BRL", transactionReason: "RENEWAL", storefront: "BRA",
};
const ok = (x: ReturnType<typeof estado>) => { if ("erro" in x) throw new Error(x.erro); return x as Estado; };

describe("the state comes from the signed documents", () => {
  it("an active period: end, signing time, product and environment exactly as signed", () => {
    expect(ok(estado(T, { autoRenewStatus: 1 }, AGORA, AGORA))).toEqual({
      p_original: "O1", p_produto: "app.vant.vendas.pro.mensal", p_ambiente: "Production", p_expira: new Date(AGORA + 29 * DIA).toISOString(),
      p_assinado: new Date(AGORA).toISOString(), p_status: "ativa", p_tolerancia: null, p_renova: true, p_revogada: null, p_transacao: "T2",
    });
  });

  it("auto-renew turned off: only the flag changes; the end of the paid period is untouched", () => {
    const e = ok(estado(T, { autoRenewStatus: 0 }, AGORA, AGORA));
    expect(e.p_renova).toBe(false);
    expect(e.p_expira).toBe(new Date(AGORA + 29 * DIA).toISOString());
    expect(e.p_revogada).toBeNull();
    expect(e.p_status).toBe("renovacao_desligada");
  });

  it("no renewal info (a transaction from the device): auto-renew is unknown, not false", () => {
    expect(ok(estado(T, null, undefined, AGORA)).p_renova).toBeNull();
    expect(ok(estado(T, null, undefined, AGORA)).p_assinado).toBe(new Date(AGORA).toISOString());
  });

  it("a refund carries its date; a refunded period has no grace", () => {
    const e = ok(estado({ ...T, revocationDate: AGORA - 1000, revocationReason: 1 }, { gracePeriodExpiresDate: AGORA + 40 * DIA }, AGORA, AGORA));
    expect(e.p_revogada).toBe(new Date(AGORA - 1000).toISOString());
    expect(e.p_tolerancia).toBeNull();
    expect(e.p_status).toBe("reembolsada");
  });

  it("Apple's billing grace period extends the access only when it ends after the paid period", () => {
    const vencida = { ...T, expiresDate: AGORA - DIA };
    expect(ok(estado(vencida, { gracePeriodExpiresDate: AGORA + 2 * DIA }, AGORA, AGORA))).toMatchObject({ p_tolerancia: new Date(AGORA + 2 * DIA).toISOString(), p_status: "em_carencia" });
    expect(ok(estado(vencida, { gracePeriodExpiresDate: AGORA - 2 * DIA }, AGORA, AGORA)).p_tolerancia).toBeNull();
    expect(ok(estado(vencida, { isInBillingRetryPeriod: true }, AGORA, AGORA)).p_status).toBe("cobranca_falhou");
    expect(ok(estado(vencida, null, AGORA, AGORA)).p_status).toBe("expirada");
  });

  it("the bank add-on is out of sale: no state to store (no right), but its ledger line still exists", () => {
    const b: Transacao = { ...T, productId: "app.vant.vendas.banco.mensal", price: 12900 };
    expect(estado(b, null, AGORA, AGORA)).toEqual({ erro: "produto_fora_de_venda" });
    expect(linhaFinanceira(b, "u", AGORA)?.p_produto).toBe("app.vant.vendas.banco.mensal");
  });

  it("renewal info of ANOTHER subscription is ignored", () => {
    const e = ok(estado(T, { originalTransactionId: "OUTRA", autoRenewStatus: 0, gracePeriodExpiresDate: AGORA + 99 * DIA }, AGORA, AGORA));
    expect(e.p_renova).toBeNull();
    expect(e.p_tolerancia).toBeNull();
  });

  it("refused before reaching the database: another app, not a subscription, unknown product, no environment, incomplete", () => {
    expect(estado({ ...T, bundleId: "com.outro" }, null, AGORA)).toEqual({ erro: "app_diferente" });
    expect(estado({ ...T, type: "Consumable" }, null, AGORA)).toEqual({ erro: "nao_e_assinatura" });
    expect(estado({ ...T, productId: "app.vant.vendas.pro.vitalicio" }, null, AGORA)).toEqual({ erro: "produto_desconhecido" });
    expect(estado({ ...T, environment: "Xcode" }, null, AGORA)).toEqual({ erro: "ambiente_invalido" });
    expect(estado({ ...T, expiresDate: undefined }, null, AGORA)).toEqual({ erro: "transacao_incompleta" });
    expect(estado({ ...T, originalTransactionId: undefined }, null, AGORA)).toEqual({ erro: "transacao_incompleta" });
  });

  it("the four approved products and no other", () => {
    expect([...PRODUTOS]).toEqual(["app.vant.vendas.essencial.mensal", "app.vant.vendas.pro.mensal", "app.vant.vendas.pro.anual", "app.vant.vendas.banco.mensal"]);
  });

  it("the label never says 'ativa' for something that is over", () => {
    expect(rotulo({ ...T, expiresDate: AGORA - 1 }, { autoRenewStatus: 1 }, AGORA)).toBe("expirada");
  });
});

describe("the owner", () => {
  it("is the account Apple signed, when it is a real account id; anything else is no token", () => {
    expect(donoPeloToken(T)).toBe("11111111-1111-4111-8111-111111111111");
    expect(donoPeloToken({ ...T, appAccountToken: "11111111-1111-4111-8111-11111111111A".toUpperCase() })).toBe("11111111-1111-4111-8111-11111111111a");
    for (const ruim of [undefined, "", "eu", "11111111-1111-4111-8111", "' or 1=1 --"]) expect(donoPeloToken({ ...T, appAccountToken: ruim })).toBeNull();
    expect(donoPeloToken(null)).toBeNull();
  });
});

describe("the ledger line", () => {
  it("price as signed (thousandths), purchase date, next renewal, reason, storefront", () => {
    expect(linhaFinanceira(T, "u1", AGORA)).toEqual({
      p_transacao: "T2", p_original: "O1", p_user: "u1", p_produto: "app.vant.vendas.pro.mensal", p_ambiente: "Production",
      p_comprado: new Date(AGORA - DIA).toISOString(), p_periodo_ate: new Date(AGORA + 29 * DIA).toISOString(), p_preco_milesimos: 49900, p_moeda: "BRL",
      p_motivo: "RENEWAL", p_reembolsado: null, p_reembolso_motivo: null, p_substituida: false, p_loja: "BRA", p_oferta: null, p_assinado: new Date(AGORA).toISOString(),
    });
  });
  it("a refund marks the same transaction; an upgrade marks it as replaced; no price signed = no amount invented", () => {
    expect(linhaFinanceira({ ...T, revocationDate: AGORA, revocationReason: 0 }, null)).toMatchObject({ p_reembolsado: new Date(AGORA).toISOString(), p_reembolso_motivo: "0", p_transacao: "T2" });
    expect(linhaFinanceira({ ...T, isUpgraded: true }, null)?.p_substituida).toBe(true);
    expect(linhaFinanceira({ ...T, price: undefined }, null)).toMatchObject({ p_preco_milesimos: null, p_moeda: null });
    expect(linhaFinanceira({ ...T, price: 49.9 }, null)?.p_preco_milesimos).toBeNull();
  });
  it("nothing to record without a transaction id, a purchase date or a known product", () => {
    expect(linhaFinanceira({ ...T, transactionId: undefined }, null)).toBeNull();
    expect(linhaFinanceira({ ...T, purchaseDate: undefined }, null)).toBeNull();
    expect(linhaFinanceira({ ...T, productId: "outro" }, null)).toBeNull();
  });
});

describe("reading a JWS without trusting it, and the log line", () => {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  it("the declared environment is found at the top or inside data; garbage gives null", () => {
    expect(ambienteDeclarado(`x.${b64({ environment: "Sandbox" })}.y`)).toBe("Sandbox");
    expect(ambienteDeclarado(`x.${b64({ data: { environment: "Production" } })}.y`)).toBe("Production");
    expect(ambienteDeclarado(`x.${b64({ environment: "Xcode" })}.y`)).toBeNull();
    for (const ruim of ["", "a.b", "a.b.c.d", "a.@@@.c", 42, null]) expect(ambienteDeclarado(ruim)).toBeNull();
    expect(espiar(`x.${b64([1, 2])}.y`)).toEqual([1, 2]);
  });
  it("the log line carries technical identifiers only", () => {
    const linha = linhaDeLog({ tipo: "DID_RENEW", uuid: "abc-1", original: "2000000000000100", user: "11111111-1111-4111-8111-111111111111", resultado: "fulana@exemplo.com apagou tudo", transacao: "eyJhbGciOiJFUzI1NiJ9.eyJ4IjoxfQ.assinatura" });
    expect(JSON.parse(linha)).toMatchObject({ tipo: "DID_RENEW", uuid: "abc-1", original: "2000000000000100", user: "11111111-1111-4111-8111-111111111111" });
    expect(linha).not.toContain("@");
    expect(linha).not.toContain(" ");
    expect(linhaDeLog({ user: "nao-e-conta" })).toContain('"user":null');
  });
});
