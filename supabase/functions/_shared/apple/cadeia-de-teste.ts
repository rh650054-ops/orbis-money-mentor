/* TEST ONLY. A fictional certificate authority shaped like Apple's (root -> intermediate with
   Apple's intermediate marker -> leaf with Apple's leaf marker), created fresh in memory on each
   run, so the REAL verification code (Apple's library: chain, markers, dates, ES256 signature) runs
   in the tests without any Apple credential. Its root is never trusted by the functions on the
   server: they are built with RAIZES_APPLE only (raizes.test.ts proves a JWS of this chain is
   refused there). No key is written to disk or committed. Never imported by function code. */
import jsrsasign from "jsrsasign";
import jwt from "jsonwebtoken";

const { KJUR, KEYUTIL } = jsrsasign;
const OID_FOLHA = "1.2.840.113635.100.6.11.1";
const OID_INTERMEDIARIA = "1.2.840.113635.100.6.2.1";

type Par = { prvKeyObj: unknown; pubKeyObj: unknown };
const par = (): Par => KEYUTIL.generateKeypair("EC", "secp256r1") as unknown as Par;
const semCabecalho = (pem: string) => pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");

function certificado(o: { serie: number; sujeito: string; emissor: string; chave: Par; chaveDoEmissor: Par; ca: boolean; oid?: string; de?: string; ate?: string }): string {
  const ext: Record<string, unknown>[] = [{ extname: "basicConstraints", cA: o.ca, critical: true }];
  if (o.oid) ext.push({ extname: o.oid, extn: "0500" });
  const c = new KJUR.asn1.x509.Certificate({
    version: 3, serial: { int: o.serie }, issuer: { str: o.emissor }, subject: { str: o.sujeito },
    notbefore: o.de ?? "250101000000Z", notafter: o.ate ?? "350101000000Z",
    sbjpubkey: o.chave.pubKeyObj, ext, sigalg: "SHA256withECDSA", cakey: o.chaveDoEmissor.prvKeyObj,
  } as never);
  return semCabecalho(c.getPEM());
}

export interface Cadeia {
  /** base64 DER of the fictional root: what a test verifier is told to trust. */
  raiz: string;
  /** Signs a payload as "Apple" would: ES256, with the three certificates in the x5c header. */
  assinar(payload: Record<string, unknown>): string;
  /** The same payload signed with a key that is NOT the leaf's (a forged signature). */
  forjar(payload: Record<string, unknown>): string;
  x5c: string[];
}

export interface OpcoesDeCadeia { folhaSemMarca?: boolean; intermediariaSemMarca?: boolean; folhaVencidaEm?: string; nome?: string }

export function criarCadeia(o: OpcoesDeCadeia = {}): Cadeia {
  const n = o.nome ?? "VANT";
  const raiz = par(), inter = par(), folha = par(), estranho = par();
  const cRaiz = certificado({ serie: 1, sujeito: `/CN=Raiz de Teste ${n}`, emissor: `/CN=Raiz de Teste ${n}`, chave: raiz, chaveDoEmissor: raiz, ca: true });
  const cInter = certificado({ serie: 2, sujeito: `/CN=Intermediaria de Teste ${n}`, emissor: `/CN=Raiz de Teste ${n}`, chave: inter, chaveDoEmissor: raiz, ca: true, oid: o.intermediariaSemMarca ? undefined : OID_INTERMEDIARIA });
  const cFolha = certificado({ serie: 3, sujeito: `/CN=Folha de Teste ${n}`, emissor: `/CN=Intermediaria de Teste ${n}`, chave: folha, chaveDoEmissor: inter, ca: false, oid: o.folhaSemMarca ? undefined : OID_FOLHA, ate: o.folhaVencidaEm });
  const x5c = [cFolha, cInter, cRaiz];
  const assinarCom = (chave: Par) => (payload: Record<string, unknown>) =>
    jwt.sign(payload, KEYUTIL.getPEM(chave.prvKeyObj as never, "PKCS8PRV"), { algorithm: "ES256", noTimestamp: true, header: { alg: "ES256", x5c } as never });
  return { raiz: cRaiz, x5c, assinar: assinarCom(folha), forjar: assinarCom(estranho) };
}

/** Rewrites one field of a signed JWS without re-signing (what an attacker who edits the body does). */
export function adulterar(jws: string, mudar: (payload: Record<string, unknown>) => void): string {
  const [h, p, s] = jws.split(".");
  const payload = JSON.parse(Buffer.from(String(p), "base64url").toString());
  mudar(payload);
  return [h, Buffer.from(JSON.stringify(payload)).toString("base64url"), s].join(".");
}

// ---- fictional signed documents -------------------------------------------------------------
export const CONTA_A = "11111111-1111-4111-8111-111111111111";
export const CONTA_B = "22222222-2222-4222-8222-222222222222";
const DIA = 86_400_000;

export function transacao(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const agora = Date.now();
  return {
    bundleId: "app.vant.vendas", environment: "Sandbox", type: "Auto-Renewable Subscription",
    transactionId: "2000000000000101", originalTransactionId: "2000000000000100", productId: "app.vant.vendas.pro.mensal",
    purchaseDate: agora - 60_000, originalPurchaseDate: agora - 60_000, expiresDate: agora + 30 * DIA, signedDate: agora,
    appAccountToken: CONTA_A, price: 49900, currency: "BRL", transactionReason: "PURCHASE", storefront: "BRA", quantity: 1,
    inAppOwnershipType: "PURCHASED", subscriptionGroupIdentifier: "21000001",
    ...extra,
  };
}
export function renovacao(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    environment: "Sandbox", originalTransactionId: "2000000000000100", productId: "app.vant.vendas.pro.mensal",
    autoRenewProductId: "app.vant.vendas.pro.mensal", autoRenewStatus: 1, signedDate: Date.now(), ...extra,
  };
}
export function notificacao(c: Cadeia, tipo: string, t: Record<string, unknown> | null, r: Record<string, unknown> | null, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const ambiente = (t?.environment ?? r?.environment ?? "Sandbox") as string;
  return {
    notificationType: tipo, notificationUUID: `uuid-ficticio-${tipo}-${Math.random().toString(36).slice(2, 10)}`, version: "2.0", signedDate: Date.now(),
    data: {
      bundleId: "app.vant.vendas", appAppleId: 6838336105, environment: ambiente, bundleVersion: "13",
      ...(t ? { signedTransactionInfo: c.assinar(t) } : {}), ...(r ? { signedRenewalInfo: c.assinar(r) } : {}),
    },
    ...extra,
  };
}

/** A stand-in for the database: answers each function as told and records every call. */
export interface Chamada { funcao: string; args: Record<string, unknown> }
export function bancoFalso(respostas: Record<string, unknown | ((args: Record<string, unknown>) => unknown)> = {}) {
  const chamadas: Chamada[] = [];
  const padrao: Record<string, unknown> = {
    apple_assinatura_gravar: "gravada", apple_transacao_registrar: "registrada", apple_evento_registrar: "novo",
    apple_evento_concluir: null, apple_expirar_vencidas: 0, apple_conciliar_lista: [], vant_direitos: [],
  };
  return {
    chamadas,
    de: (funcao: string) => chamadas.filter((c) => c.funcao === funcao),
    rpc(funcao: string, args: Record<string, unknown> = {}) {
      chamadas.push({ funcao, args });
      const r = funcao in respostas ? respostas[funcao] : padrao[funcao];
      try {
        const data = typeof r === "function" ? (r as (a: Record<string, unknown>) => unknown)(args) : r;
        return Promise.resolve({ data, error: null });
      } catch (e) {
        return Promise.resolve({ data: null, error: { message: e instanceof Error ? e.message : "erro" } });
      }
    },
  };
}
