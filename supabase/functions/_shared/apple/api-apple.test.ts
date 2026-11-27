// @vitest-environment node
/* Asking Apple (App Store Server API) with our WebCrypto-signed request, with a key created here and
   the network intercepted: what we send (a request signed with the In-App Purchase key, to the right
   environment) and what we do with each kind of answer. No Apple credential is used. */
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../../src/test/msw-server";
import { chaveNormalizada, credenciaisDe, criarClienteApple, FalhaNaApple } from "./api-apple";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const chave = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const publica = publicKey.export({ type: "spki", format: "pem" }).toString();
const cliente = criarClienteApple({ chave, keyId: "CHAVEFICT1", issuerId: "11111111-2222-3333-4444-555555555555", bundleId: "app.vant.vendas" });
const SANDBOX = "https://api.storekit-sandbox.apple.com/inApps/v1/subscriptions/:id";
const PRODUCAO = "https://api.storekit.apple.com/inApps/v1/subscriptions/:id";
const corpo = { environment: "Sandbox", bundleId: "app.vant.vendas", data: [
  { subscriptionGroupIdentifier: "21000001", lastTransactions: [{ originalTransactionId: "2000000000000100", status: 1, signedTransactionInfo: "jws-da-transacao", signedRenewalInfo: "jws-da-renovacao" }] },
  { subscriptionGroupIdentifier: "21000002", lastTransactions: [{ originalTransactionId: "2000000000000200", status: 2, signedTransactionInfo: "jws-do-banco" }, { originalTransactionId: "2000000000000300", status: 1 }] },
] };

describe("the request", () => {
  it("goes to the environment asked, for the transaction asked, signed with the In-App Purchase key (ES256, key id, issuer, bundle id, short life)", async () => {
    const vistos: { url: string; auth: string }[] = [];
    server.use(
      http.get(SANDBOX, ({ request }) => { vistos.push({ url: request.url, auth: request.headers.get("authorization") ?? "" }); return HttpResponse.json(corpo); }),
      http.get(PRODUCAO, ({ request }) => { vistos.push({ url: request.url, auth: request.headers.get("authorization") ?? "" }); return HttpResponse.json({ data: [] }); }),
    );
    const lista = await cliente.status("2000000000000100", "Sandbox");
    expect(await cliente.status("1000000000000100", "Production")).toEqual([]);
    expect(vistos.map((v) => v.url.replace(/\?$/, ""))).toEqual(["https://api.storekit-sandbox.apple.com/inApps/v1/subscriptions/2000000000000100", "https://api.storekit.apple.com/inApps/v1/subscriptions/1000000000000100"]);
    // every subscription of the customer comes back; an entry with no signed transaction is dropped
    expect(lista).toEqual([
      { original: "2000000000000100", status: 1, transacao: "jws-da-transacao", renovacao: "jws-da-renovacao" },
      { original: "2000000000000200", status: 2, transacao: "jws-do-banco", renovacao: null },
    ]);
    const token = String(vistos[0]?.auth).replace(/^Bearer /, "");
    const dentro = jwt.verify(token, publica, { algorithms: ["ES256"], complete: true }) as unknown as { header: Record<string, unknown>; payload: Record<string, unknown> };
    expect(dentro.header).toMatchObject({ alg: "ES256", kid: "CHAVEFICT1" });
    expect(dentro.payload).toMatchObject({ iss: "11111111-2222-3333-4444-555555555555", bid: "app.vant.vendas", aud: "appstoreconnect-v1" });
    expect(Number(dentro.payload.exp) - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(3600);
    expect(token).not.toContain(chave.slice(40, 80));
  });
});

describe("the answers", () => {
  it("404: Apple does not know that transaction in that environment -> null, not an error", async () => {
    server.use(http.get(SANDBOX, () => HttpResponse.json({ errorCode: 4040010, errorMessage: "Transaction id not found." }, { status: 404 })));
    expect(await cliente.status("2000000000000999", "Sandbox")).toBeNull();
  });

  it("401 (key refused), 429 (too many requests), 500: a failure the caller can tell from 'not found', carrying the status", async () => {
    for (const [http_, codigo] of [[401, null], [429, 4290000], [500, 5000000]] as const) {
      server.use(http.get(SANDBOX, () => codigo ? HttpResponse.json({ errorCode: codigo, errorMessage: "x" }, { status: http_ }) : new HttpResponse(null, { status: http_ })));
      const e = await cliente.status("2000000000000100", "Sandbox").catch((x) => x);
      expect(e).toBeInstanceOf(FalhaNaApple);
      expect((e as FalhaNaApple).http).toBe(http_);
      expect((e as FalhaNaApple).codigo).toBe(codigo);
      expect(String((e as Error).message)).not.toContain("BEGIN");
    }
  });

  it("the network fails: a failure too, never an empty list that could be read as 'no subscription'", async () => {
    server.use(http.get(SANDBOX, () => HttpResponse.error()));
    const e = await cliente.status("2000000000000100", "Sandbox").catch((x) => x);
    expect(e).toBeInstanceOf(FalhaNaApple);
    expect((e as FalhaNaApple).http).toBeNull();
  });
});

describe("the key from the panel", () => {
  it("is used only when the three secrets are there; missing any of them means 'no client'", () => {
    const env = (o: Record<string, string>) => (k: string) => o[k];
    expect(credenciaisDe(env({}), "app.vant.vendas")).toBeNull();
    expect(credenciaisDe(env({ APPLE_IAP_PRIVATE_KEY: chave, APPLE_IAP_KEY_ID: "K" }), "app.vant.vendas")).toBeNull();
    expect(credenciaisDe(env({ APPLE_IAP_PRIVATE_KEY: chave, APPLE_IAP_KEY_ID: " K ", APPLE_IAP_ISSUER_ID: " I " }), "app.vant.vendas")).toMatchObject({ keyId: "K", issuerId: "I", bundleId: "app.vant.vendas" });
  });

  it("a .p8 pasted on one line, or with \\n written out, is put back in shape and still signs", async () => {
    const umaLinha = chave.replace(/\n/g, " ").trim();
    const escapada = chave.trim().replace(/\n/g, "\\n");
    for (const colada of [umaLinha, escapada, chave]) {
      const pem = chaveNormalizada(colada);
      expect(pem.startsWith("-----BEGIN PRIVATE KEY-----\n")).toBe(true);
      const t = jwt.sign({ a: 1 }, pem, { algorithm: "ES256" });
      expect(jwt.verify(t, publica, { algorithms: ["ES256"] })).toMatchObject({ a: 1 });
    }
  });
});
