/* Apple subscriptions: is this really signed by Apple, for THIS app?
   The same checks Apple's App Store Server Library makes offline (SignedDataVerifier), done with
   WebCrypto (see certificado.ts for why the library itself cannot run on the Supabase Edge runtime).
   For every signed document:
     - the JWS header is ES256 with exactly three certificates (x5c);
     - the intermediate is signed by a PINNED root ("Apple Root CA - G3", raizes.ts; the root inside
       the JWS is never trusted), the leaf by the intermediate, each issuer name matching;
     - the intermediate is a CA and carries Apple's intermediate marker, the leaf Apple's leaf marker;
     - the three certificates were valid when Apple signed the document (60 s of tolerance);
     - the ES256 signature of the document, with the leaf's key;
     - the bundle id (and, in Production, the app's numeric id) and the environment.
   Anything that fails is refused: an invented JWS, one signed under another root, one whose content
   was edited after signing, one of another app, a Sandbox one presented as Production.
   The result names are the library's, so callers and logs did not change.
   NOT done: asking Apple's revocation service (OCSP), the `online` option. It was off in production;
   the chain, the markers, the dates and the signature are always checked. */
import { ambienteDeclarado, type Ambiente, type Notificacao, type Renovacao, type Transacao } from "./regras.ts";
import { assinadoPor, CertificadoInvalido, chavePublica, lerCertificado, type Certificado } from "./certificado.ts";

export class AssinaturaInvalida extends Error {
  /** tentarDeNovo: the document may be fine and OUR side could not check it now (try again later). */
  constructor(public motivo: string, public tentarDeNovo = false) { super(motivo); this.name = "AssinaturaInvalida"; }
}

export interface Verificador {
  transacao(jws: string): Promise<Transacao>;
  renovacao(jws: string): Promise<Renovacao>;
  notificacao(jws: string): Promise<Notificacao>;
}

export interface ConfigVerificador {
  /** Trusted roots, base64 of the DER. In production: only RAIZES_APPLE. */
  raizes: string[];
  bundleId: string;
  appAppleId: number;
  /** Revocation checks (OCSP). Not supported: must be false. */
  online: boolean;
}

const OID_FOLHA = "1.2.840.113635.100.6.11.1";
const OID_INTERMEDIARIA = "1.2.840.113635.100.6.2.1";
const TOLERANCIA_MS = 60_000;

const base64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const base64url = (s: string): Uint8Array => base64(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
const json = (s: string): Record<string, unknown> => {
  const v = JSON.parse(new TextDecoder().decode(base64url(s)));
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("json");
  return v as Record<string, unknown>;
};

/** Refusal with the library's status names (what the logs and tests already know). */
const falha = (motivo: string): never => { throw new AssinaturaInvalida(motivo); };

export function criarVerificador(cfg: ConfigVerificador): Verificador {
  if (cfg.online) throw new Error("verificacao online (OCSP) nao suportada");
  const raizes = cfg.raizes.map((r) => lerCertificado(base64(r)));

  async function verificar(jws: string, quando: (p: Record<string, unknown>) => number | undefined): Promise<Record<string, unknown>> {
    const [h, p, s, ...sobra] = jws.split(".");
    if (!h || !p || sobra.length) falha("VERIFICATION_FAILURE");
    let cabecalho: Record<string, unknown>, payload: Record<string, unknown>;
    try { cabecalho = json(h!); payload = json(p!); } catch { return falha("VERIFICATION_FAILURE"); }

    // the certificates (an unreadable or short chain: INVALID_CERTIFICATE, as the library)
    let folha: Certificado, inter: Certificado;
    try {
      const x5c = cabecalho.x5c;
      if (!Array.isArray(x5c) || x5c.length !== 3 || !x5c.every((c) => typeof c === "string")) throw new CertificadoInvalido("x5c");
      folha = lerCertificado(base64(x5c[0] as string));
      inter = lerCertificado(base64(x5c[1] as string));
    } catch { return falha("INVALID_CERTIFICATE"); }
    if (cabecalho.alg !== "ES256" || !s) falha("VERIFICATION_FAILURE");

    // the chain, up to a PINNED root
    let raiz: Certificado | null = null;
    for (const r of raizes) if (inter.emissor === r.sujeito && await assinadoPor(inter, r)) raiz = r;
    const valida = !!raiz && folha.emissor === inter.sujeito && await assinadoPor(folha, inter) && inter.ca
      && folha.extensoes.has(OID_FOLHA) && inter.extensoes.has(OID_INTERMEDIARIA);
    if (!valida) falha("VERIFICATION_FAILURE");

    // dates, at the moment Apple signed the document
    const t = quando(payload) ?? Date.now();
    for (const c of [folha, inter, raiz!]) {
      if (c.validoDe.getTime() > t + TOLERANCIA_MS || c.validoAte.getTime() < t - TOLERANCIA_MS) falha("INVALID_CERTIFICATE");
    }

    // the document's own signature (ES256: P-256, SHA-256, r||s)
    const sig = base64url(s!);
    if (folha.curva !== "P-256" || sig.length !== 64) falha("VERIFICATION_FAILURE");
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, await chavePublica(folha), sig, new TextEncoder().encode(`${h}.${p}`));
    if (!ok) falha("VERIFICATION_FAILURE");
    return payload;
  }

  const tentar = async <T>(jws: string, f: (amb: Ambiente) => Promise<T>): Promise<T> => {
    if (typeof jws !== "string" || jws.length < 20 || jws.length > 200_000) throw new AssinaturaInvalida("formato");
    // the claim is read without trust only to pick the environment; the checks then confirm it
    const amb = ambienteDeclarado(jws);
    if (!amb) throw new AssinaturaInvalida("ambiente_ausente");
    try {
      return await f(amb);
    } catch (e) {
      if (e instanceof AssinaturaInvalida) throw e;
      // anything else is OUR failure (the runtime, the crypto API): never a verdict on the document
      console.error("apple verificador: erro interno", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      throw new AssinaturaInvalida("erro_interno", true);
    }
  };
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);

  return {
    transacao: (jws) => tentar(jws, async (amb) => {
      const t = await verificar(jws, (p) => num(p.signedDate));
      if (t.bundleId !== cfg.bundleId) falha("INVALID_APP_IDENTIFIER");
      if (t.environment !== amb) falha("INVALID_ENVIRONMENT");
      return t as Transacao;
    }),
    renovacao: (jws) => tentar(jws, async (amb) => {
      const r = await verificar(jws, (p) => num(p.signedDate));
      if (r.environment !== amb) falha("INVALID_ENVIRONMENT");
      return r as Renovacao;
    }),
    notificacao: (jws) => tentar(jws, async (amb) => {
      const n = await verificar(jws, (p) => num(p.signedDate));
      const d = (n.data ?? n.summary) as { bundleId?: unknown; appAppleId?: unknown; environment?: unknown } | undefined;
      if (!d || d.bundleId !== cfg.bundleId || (amb === "Production" && d.appAppleId !== cfg.appAppleId)) falha("INVALID_APP_IDENTIFIER");
      if (d!.environment !== amb) falha("INVALID_ENVIRONMENT");
      return n as Notificacao;
    }),
  };
}
