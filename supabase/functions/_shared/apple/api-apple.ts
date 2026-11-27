/* Apple subscriptions: asking Apple itself (App Store Server API) for the current status of one
   subscription. Uses Apple's official client, which signs each request with the In-App Purchase key
   that Rick stores in the Supabase panel (APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_PRIVATE_KEY).
   The key never leaves the server, is never logged and is never sent anywhere but to Apple.
   What comes back is again SIGNED by Apple, and the caller verifies it like everything else. */
import { APIException, AppStoreServerAPIClient, Environment } from "npm:@apple/app-store-server-library@3.1.0";
import type { Ambiente } from "./regras.ts";

/** One subscription as Apple reports it now. Both documents are JWS still to be verified. */
export interface StatusApple { original: string; status: number | null; transacao: string; renovacao: string | null }

export interface ClienteApple {
  /** Every subscription of the customer who owns this transaction. null = Apple does not know it. */
  status(transactionId: string, ambiente: Ambiente): Promise<StatusApple[] | null>;
}

export class FalhaNaApple extends Error {
  constructor(public http: number | null, public codigo: number | null) { super(`apple_api_${http ?? "rede"}`); this.name = "FalhaNaApple"; }
}

export interface Credenciais { chave: string; keyId: string; issuerId: string; bundleId: string }

/** The .p8 pasted into a secret usually loses its line breaks: put them back. */
export function chaveNormalizada(v: string): string {
  const s = v.trim().replace(/\\n/g, "\n");
  if (s.includes("\n")) return s;
  const miolo = s.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  return `-----BEGIN PRIVATE KEY-----\n${miolo.match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END PRIVATE KEY-----`;
}

export function credenciaisDe(env: (k: string) => string | undefined, bundleId: string): Credenciais | null {
  const chave = env("APPLE_IAP_PRIVATE_KEY"), keyId = env("APPLE_IAP_KEY_ID"), issuerId = env("APPLE_IAP_ISSUER_ID");
  if (!chave || !keyId || !issuerId) return null;
  return { chave: chaveNormalizada(chave), keyId: keyId.trim(), issuerId: issuerId.trim(), bundleId };
}

export function criarClienteApple(c: Credenciais): ClienteApple {
  const porAmbiente = new Map<Ambiente, AppStoreServerAPIClient>();
  const para = (amb: Ambiente) => {
    let x = porAmbiente.get(amb);
    if (!x) {
      x = new AppStoreServerAPIClient(c.chave, c.keyId, c.issuerId, c.bundleId, amb === "Production" ? Environment.PRODUCTION : Environment.SANDBOX);
      porAmbiente.set(amb, x);
    }
    return x;
  };
  return {
    async status(transactionId, ambiente) {
      try {
        const r = await para(ambiente).getAllSubscriptionStatuses(transactionId);
        const saida: StatusApple[] = [];
        for (const grupo of r.data ?? []) {
          for (const u of grupo.lastTransactions ?? []) {
            if (!u.originalTransactionId || !u.signedTransactionInfo) continue;
            saida.push({ original: u.originalTransactionId, status: typeof u.status === "number" ? u.status : null, transacao: u.signedTransactionInfo, renovacao: u.signedRenewalInfo ?? null });
          }
        }
        return saida;
      } catch (e) {
        // Apple's client throws APIException (HTTP status + Apple's error code). Recognised by its
        // shape too: the class can be loaded twice (npm and Deno module graphs).
        const x = e as { httpStatusCode?: unknown; apiError?: unknown } | null;
        if (e instanceof APIException || typeof x?.httpStatusCode === "number") {
          const http = Number(x?.httpStatusCode);
          // 404: Apple has no such transaction in this environment
          if (http === 404) return null;
          throw new FalhaNaApple(http, typeof x?.apiError === "number" ? x.apiError : null);
        }
        throw new FalhaNaApple(null, null);
      }
    },
  };
}
