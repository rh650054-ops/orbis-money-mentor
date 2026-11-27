// @vitest-environment node
/* Is it really Apple's? The REAL verification (Apple's official library) against a fictional
   authority shaped like Apple's, plus the proof that the server trusts Apple's root and nothing else. */
import { createHash, X509Certificate } from "node:crypto";
import { describe, expect, it } from "vitest";
import { adulterar, criarCadeia, notificacao, renovacao, transacao } from "./cadeia-de-teste";
import { APPLE_ROOT_CA_G3, APPLE_ROOT_CA_G3_SHA256, RAIZES_APPLE } from "./raizes";
import { APP_APPLE_ID, BUNDLE_ID } from "./regras";
import { AssinaturaInvalida, criarVerificador } from "./verificador";

const cadeia = criarCadeia();
const v = criarVerificador({ raizes: [cadeia.raiz], bundleId: BUNDLE_ID, appAppleId: APP_APPLE_ID, online: false });
const recusa = async (p: Promise<unknown>) => { try { await p; return "ACEITOU"; } catch (e) { return e instanceof AssinaturaInvalida ? e.motivo : `outro erro: ${String(e)}`; } };

describe("Apple's root, pinned", () => {
  it("the embedded certificate is Apple Root CA - G3: its SHA-256 is the one Apple publishes", () => {
    const der = Buffer.from(APPLE_ROOT_CA_G3, "base64");
    expect(createHash("sha256").update(der).digest("hex")).toBe(APPLE_ROOT_CA_G3_SHA256);
    expect(APPLE_ROOT_CA_G3_SHA256).toBe("63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179");
    const c = new X509Certificate(der);
    expect(c.subject).toContain("CN=Apple Root CA - G3");
    expect(c.subject).toBe(c.issuer);
    expect(new Date(c.validTo).getUTCFullYear()).toBe(2039);
    expect(RAIZES_APPLE).toEqual([APPLE_ROOT_CA_G3]);
  });

  it("the server's verifier (Apple's root only) refuses a document signed by the fictional authority of the tests", async () => {
    const real = criarVerificador({ raizes: RAIZES_APPLE, bundleId: BUNDLE_ID, appAppleId: APP_APPLE_ID, online: false });
    expect(await recusa(real.transacao(cadeia.assinar(transacao())))).toBe("VERIFICATION_FAILURE");
    expect(await recusa(real.transacao(cadeia.assinar(transacao({ environment: "Production" }))))).toBe("VERIFICATION_FAILURE");
    expect(await recusa(real.notificacao(cadeia.assinar(notificacao(cadeia, "DID_RENEW", transacao(), null))))).toBe("VERIFICATION_FAILURE");
  });
});

describe("a signed transaction", () => {
  it("valid chain, valid signature, this app: accepted, and the content is what was signed", async () => {
    const t = await v.transacao(cadeia.assinar(transacao({ price: 419900, productId: "app.vant.vendas.pro.anual" })));
    expect(t).toMatchObject({ bundleId: BUNDLE_ID, productId: "app.vant.vendas.pro.anual", price: 419900, environment: "Sandbox" });
  });

  it("content edited after signing (another product, a later end, another account): refused", async () => {
    const jws = cadeia.assinar(transacao({ productId: "app.vant.vendas.essencial.mensal" }));
    expect(await recusa(v.transacao(adulterar(jws, (p) => { p.productId = "app.vant.vendas.pro.anual"; })))).toBe("VERIFICATION_FAILURE");
    expect(await recusa(v.transacao(adulterar(jws, (p) => { p.expiresDate = Date.now() + 9e11; })))).toBe("VERIFICATION_FAILURE");
    expect(await recusa(v.transacao(adulterar(jws, (p) => { p.appAccountToken = "22222222-2222-4222-8222-222222222222"; })))).toBe("VERIFICATION_FAILURE");
  });

  it("signed with a key that is not the certificate's (forged): refused", async () => {
    expect(await recusa(v.transacao(cadeia.forjar(transacao())))).toBe("VERIFICATION_FAILURE");
  });

  it("signed by another authority, even one shaped exactly like Apple's: refused", async () => {
    const outra = criarCadeia({ nome: "Impostora" });
    expect(await recusa(v.transacao(outra.assinar(transacao())))).toBe("VERIFICATION_FAILURE");
  });

  it("certificates without Apple's markers: refused", async () => {
    for (const o of [{ folhaSemMarca: true }, { intermediariaSemMarca: true }]) {
      const c = criarCadeia(o);
      const vv = criarVerificador({ raizes: [c.raiz], bundleId: BUNDLE_ID, appAppleId: APP_APPLE_ID, online: false });
      expect(await recusa(vv.transacao(c.assinar(transacao())))).toBe("VERIFICATION_FAILURE");
    }
  });

  it("a certificate that had expired when the document was signed: refused", async () => {
    const c = criarCadeia({ folhaVencidaEm: "250601000000Z" });
    const vv = criarVerificador({ raizes: [c.raiz], bundleId: BUNDLE_ID, appAppleId: APP_APPLE_ID, online: false });
    expect(await recusa(vv.transacao(c.assinar(transacao())))).toBe("INVALID_CERTIFICATE");
  });

  it("no certificates, a short chain, no signature, or not a JWS at all: refused", async () => {
    const jws = cadeia.assinar(transacao());
    const [h, p, s] = jws.split(".");
    const cabecalho = (x: Record<string, unknown>) => Buffer.from(JSON.stringify(x)).toString("base64url");
    expect(await recusa(v.transacao([cabecalho({ alg: "ES256" }), p, s].join(".")))).toBe("INVALID_CERTIFICATE");
    expect(await recusa(v.transacao([cabecalho({ alg: "ES256", x5c: cadeia.x5c.slice(0, 2) }), p, s].join(".")))).toBe("INVALID_CERTIFICATE");
    expect(await recusa(v.transacao([cabecalho({ alg: "none", x5c: cadeia.x5c }), p, ""].join(".")))).not.toBe("ACEITOU");
    expect(await recusa(v.transacao([h, p, ""].join(".")))).not.toBe("ACEITOU");
    expect(await recusa(v.transacao("isto-nao-e-um-jws"))).toBe("formato");
    expect(await recusa(v.transacao(JSON.stringify(transacao())))).not.toBe("ACEITOU");
    expect(await recusa(v.transacao(undefined as unknown as string))).toBe("formato");
  });

  it("a transaction of another app: refused", async () => {
    expect(await recusa(v.transacao(cadeia.assinar(transacao({ bundleId: "com.outro.app" }))))).toBe("INVALID_APP_IDENTIFIER");
  });

  it("the environment is the one Apple signed: it cannot be swapped after signing, and one without it is refused", async () => {
    const sandbox = cadeia.assinar(transacao({ environment: "Sandbox" }));
    expect(await recusa(v.transacao(adulterar(sandbox, (p) => { p.environment = "Production"; })))).toBe("VERIFICATION_FAILURE");
    expect(await recusa(v.transacao(cadeia.assinar(transacao({ environment: undefined }))))).toBe("ambiente_ausente");
    expect(await recusa(v.transacao(cadeia.assinar(transacao({ environment: "Xcode" }))))).toBe("ambiente_ausente");
    expect((await v.transacao(cadeia.assinar(transacao({ environment: "Production" })))).environment).toBe("Production");
  });
});

describe("a signed notification and a signed renewal info", () => {
  it("accepted when Apple's; the notification must be of this app (bundle id and, in Production, the app id)", async () => {
    const n = await v.notificacao(cadeia.assinar(notificacao(cadeia, "DID_RENEW", transacao(), renovacao())));
    expect(n.notificationType).toBe("DID_RENEW");
    expect((await v.renovacao(String(n.data?.signedRenewalInfo))).autoRenewStatus).toBe(1);
    const outroApp = notificacao(cadeia, "DID_RENEW", transacao(), null);
    (outroApp.data as Record<string, unknown>).bundleId = "com.outro.app";
    expect(await recusa(v.notificacao(cadeia.assinar(outroApp)))).toBe("INVALID_APP_IDENTIFIER");
    const prod = notificacao(cadeia, "DID_RENEW", transacao({ environment: "Production" }), null);
    (prod.data as Record<string, unknown>).appAppleId = 123;
    expect(await recusa(v.notificacao(cadeia.assinar(prod)))).toBe("INVALID_APP_IDENTIFIER");
  });

  it("an edited or forged notification: refused", async () => {
    const jws = cadeia.assinar(notificacao(cadeia, "REFUND", transacao(), null));
    expect(await recusa(v.notificacao(adulterar(jws, (p) => { p.notificationType = "DID_RENEW"; })))).toBe("VERIFICATION_FAILURE");
    expect(await recusa(v.notificacao(cadeia.forjar(notificacao(cadeia, "DID_RENEW", transacao(), null))))).toBe("VERIFICATION_FAILURE");
  });
});
