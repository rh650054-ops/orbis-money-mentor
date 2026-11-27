/* Apple subscriptions: asking Apple itself (App Store Server API) for the current status of one
   subscription: GET /inApps/v1/subscriptions/{transactionId}, signed with the In-App Purchase key
   that Rick stores in the Supabase panel (APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_PRIVATE_KEY).
   The key never leaves the server, is never logged and is never sent anywhere but to Apple.
   What comes back is again SIGNED by Apple, and the caller verifies it like everything else.
   27/11/2026: the request token is signed with WebCrypto and sent with fetch. Apple's official client
   signs with jsonwebtoken, which refuses the P-256 key on the Supabase Edge runtime (the runtime names
   the curve "p256"): see certificado.ts. */
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

const HOSTS: Record<Ambiente, string> = { Production: "https://api.storekit.apple.com", Sandbox: "https://api.storekit-sandbox.apple.com" };

const b64url = (b: Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : b;
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** The App Store Server API token: ES256, short life (5 minutes), for this app only. */
async function token(c: Credenciais, chave: CryptoKey): Promise<string> {
  const agora = Math.floor(Date.now() / 1000);
  const corpo = `${b64url(JSON.stringify({ alg: "ES256", kid: c.keyId, typ: "JWT" }))}.${b64url(JSON.stringify({ iss: c.issuerId, iat: agora, exp: agora + 300, aud: "appstoreconnect-v1", bid: c.bundleId }))}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, chave, new TextEncoder().encode(corpo)));
  return `${corpo}.${b64url(sig)}`;
}

function importarChave(pem: string): Promise<CryptoKey> {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (x) => x.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export function criarClienteApple(c: Credenciais): ClienteApple {
  let chave: Promise<CryptoKey> | null = null;
  return {
    async status(transactionId, ambiente) {
      let r: Response;
      try {
        chave ??= importarChave(c.chave);
        const url = `${HOSTS[ambiente]}/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`;
        r = await fetch(url, { headers: { Authorization: `Bearer ${await token(c, await chave)}`, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
      } catch {
        // network, timeout, or a key that cannot be read: never an empty list ("no subscription")
        chave = null;
        throw new FalhaNaApple(null, null);
      }
      if (r.status === 404) return null; // Apple has no such transaction in this environment
      if (!r.ok) {
        const erro = (await r.json().catch(() => null)) as { errorCode?: unknown } | null;
        throw new FalhaNaApple(r.status, typeof erro?.errorCode === "number" ? erro.errorCode : null);
      }
      const corpo = (await r.json().catch(() => null)) as { data?: { lastTransactions?: { originalTransactionId?: string; status?: unknown; signedTransactionInfo?: string; signedRenewalInfo?: string }[] }[] } | null;
      if (!corpo) throw new FalhaNaApple(r.status, null);
      const saida: StatusApple[] = [];
      for (const grupo of corpo.data ?? []) {
        for (const u of grupo.lastTransactions ?? []) {
          if (!u.originalTransactionId || !u.signedTransactionInfo) continue;
          saida.push({ original: u.originalTransactionId, status: typeof u.status === "number" ? u.status : null, transacao: u.signedTransactionInfo, renovacao: u.signedRenewalInfo ?? null });
        }
      }
      return saida;
    },
  };
}
