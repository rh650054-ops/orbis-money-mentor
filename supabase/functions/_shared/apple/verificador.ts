/* Apple subscriptions: is this really signed by Apple, for THIS app?
   Uses Apple's own App Store Server Library (official). For every signed document it checks:
     - the certificate chain inside the JWS up to "Apple Root CA - G3" (raizes.ts), the Apple
       marker extensions of the leaf and of the intermediate, and the validity dates;
     - the ES256 signature of the document with the leaf's key;
     - the bundle id (and, in Production, the app's numeric id) and the environment.
   Anything that fails any of these is refused: an invented JWS, one signed under another root, one
   whose content was edited after signing, one of another app, a Sandbox one presented as Production.
   The only file in the Apple functions that imports the library (the handlers get this by injection). */
import { Environment, SignedDataVerifier, VerificationException, VerificationStatus } from "npm:@apple/app-store-server-library@3.1.0";
import { Buffer } from "node:buffer";
import { ambienteDeclarado, type Ambiente, type Notificacao, type Renovacao, type Transacao } from "./regras.ts";

export class AssinaturaInvalida extends Error {
  /** tentarDeNovo: Apple's revocation service did not answer; the document may be fine. */
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
  /** true = also ask Apple's revocation service (OCSP) about the certificates of each JWS. */
  online: boolean;
}

export function criarVerificador(cfg: ConfigVerificador): Verificador {
  const raizes = cfg.raizes.map((r) => Buffer.from(r, "base64"));
  const porAmbiente = new Map<Ambiente, SignedDataVerifier>();
  const para = (jws: string): SignedDataVerifier => {
    // the claim is read without trust only to pick the verifier; the verifier then checks it
    const amb = ambienteDeclarado(jws);
    if (!amb) throw new AssinaturaInvalida("ambiente_ausente");
    let v = porAmbiente.get(amb);
    if (!v) {
      v = new SignedDataVerifier(raizes, cfg.online, amb === "Production" ? Environment.PRODUCTION : Environment.SANDBOX, cfg.bundleId, cfg.appAppleId);
      porAmbiente.set(amb, v);
    }
    return v;
  };
  const tentar = async <T>(jws: string, f: (v: SignedDataVerifier) => Promise<T>): Promise<T> => {
    if (typeof jws !== "string" || jws.length < 20 || jws.length > 200_000) throw new AssinaturaInvalida("formato");
    const v = para(jws);
    try {
      return await f(v);
    } catch (e) {
      if (e instanceof VerificationException) {
        throw new AssinaturaInvalida(VerificationStatus[e.status] ?? "FALHA", e.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE);
      }
      throw new AssinaturaInvalida("FALHA");
    }
  };
  return {
    transacao: (jws) => tentar(jws, (v) => v.verifyAndDecodeTransaction(jws)) as Promise<Transacao>,
    renovacao: (jws) => tentar(jws, (v) => v.verifyAndDecodeRenewalInfo(jws)) as Promise<Renovacao>,
    notificacao: (jws) => tentar(jws, (v) => v.verifyAndDecodeNotification(jws)) as Promise<Notificacao>,
  };
}
