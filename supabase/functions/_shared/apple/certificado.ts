/* Apple subscriptions: reading an X.509 certificate (DER) and checking its signature with WebCrypto.
   Why it exists (27/11/2026, first Sandbox purchase): the Supabase Edge runtime (supabase-edge-runtime
   1.79.1, Deno 2.1.4 compatible) does NOT implement node:crypto's X509Certificate.verify/toString,
   and reports the P-256 curve as "p256", which jsonwebtoken refuses. Apple's official library depends
   on both, so on the server it answered VERIFICATION_FAILURE to every genuine document. WebCrypto
   (crypto.subtle) is fully implemented there, in Node and in Deno, so the checks are done with it.
   Only what the verification needs is read; anything unexpected in the structure throws. Pure. */

export class CertificadoInvalido extends Error {
  constructor(motivo: string) { super(motivo); this.name = "CertificadoInvalido"; }
}

interface No { tag: number; ini: number; conteudo: number; fim: number }

function ler(b: Uint8Array, pos: number): No {
  if (pos + 2 > b.length) throw new CertificadoInvalido("der_curto");
  const tag = b[pos]!;
  let p = pos + 1;
  let tam = b[p++]!;
  if (tam & 0x80) {
    const n = tam & 0x7f;
    if (n < 1 || n > 4) throw new CertificadoInvalido("der_tamanho");
    tam = 0;
    for (let i = 0; i < n; i++) tam = tam * 256 + b[p++]!;
  }
  if (p + tam > b.length) throw new CertificadoInvalido("der_truncado");
  return { tag, ini: pos, conteudo: p, fim: p + tam };
}

function filhos(b: Uint8Array, no: No): No[] {
  const saida: No[] = [];
  let p = no.conteudo;
  while (p < no.fim) { const f = ler(b, p); saida.push(f); p = f.fim; }
  if (p !== no.fim) throw new CertificadoInvalido("der_filhos");
  return saida;
}

const SEQ = 0x30, SET = 0x31, OID = 0x06, BIT = 0x03, OCTETO = 0x04, BOOL = 0x01, INT = 0x02;

function exigir(no: No | undefined, tag: number): No {
  if (!no || no.tag !== tag) throw new CertificadoInvalido(`der_tag_${tag}`);
  return no;
}

function oid(b: Uint8Array, no: No): string {
  exigir(no, OID);
  const v = b.subarray(no.conteudo, no.fim);
  if (v.length === 0) throw new CertificadoInvalido("oid_vazio");
  const partes = [Math.floor(v[0]! / 40), v[0]! % 40];
  let acc = 0;
  for (let i = 1; i < v.length; i++) {
    acc = acc * 128 + (v[i]! & 0x7f);
    if (!(v[i]! & 0x80)) { partes.push(acc); acc = 0; }
  }
  return partes.join(".");
}

function texto(b: Uint8Array, no: No): string {
  const v = b.subarray(no.conteudo, no.fim);
  if (no.tag === 0x1e) { // BMPString, UTF-16BE
    let s = "";
    for (let i = 0; i + 1 < v.length; i += 2) s += String.fromCharCode(v[i]! * 256 + v[i + 1]!);
    return s;
  }
  return new TextDecoder().decode(v); // UTF8String, PrintableString, IA5String, T61String
}

/** A Name as "oid=value" pairs in order: two Names are the same entity when these are equal. */
function nome(b: Uint8Array, no: No): string {
  exigir(no, SEQ);
  const partes: string[] = [];
  for (const rdn of filhos(b, no)) {
    exigir(rdn, SET);
    for (const atv of filhos(b, rdn)) {
      const [t, v] = filhos(b, exigir(atv, SEQ));
      if (!t || !v) throw new CertificadoInvalido("nome");
      partes.push(`${oid(b, t)}=${texto(b, v)}`);
    }
  }
  return partes.join(",");
}

function data(b: Uint8Array, no: No): Date {
  const s = new TextDecoder().decode(b.subarray(no.conteudo, no.fim));
  let m: RegExpMatchArray | null;
  if (no.tag === 0x17 && (m = s.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/))) {
    const ano = Number(m[1]) >= 50 ? 1900 + Number(m[1]) : 2000 + Number(m[1]);
    return new Date(Date.UTC(ano, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])));
  }
  if (no.tag === 0x18 && (m = s.match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)Z$/))) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])));
  }
  throw new CertificadoInvalido("data");
}

const CURVAS: Record<string, { nome: "P-256" | "P-384"; bytes: number }> = {
  "1.2.840.10045.3.1.7": { nome: "P-256", bytes: 32 },
  "1.3.132.0.34": { nome: "P-384", bytes: 48 },
};
const ALGORITMOS: Record<string, "SHA-256" | "SHA-384"> = {
  "1.2.840.10045.4.3.2": "SHA-256", // ecdsa-with-SHA256
  "1.2.840.10045.4.3.3": "SHA-384", // ecdsa-with-SHA384
};

export interface Certificado {
  emissor: string;
  sujeito: string;
  validoDe: Date;
  validoAte: Date;
  /** basicConstraints cA = true */
  ca: boolean;
  /** OIDs of every extension present */
  extensoes: Set<string>;
  curva: "P-256" | "P-384";
  bytesDaCurva: number;
  /** SubjectPublicKeyInfo (DER), for crypto.subtle.importKey("spki") */
  spki: Uint8Array;
  /** what the issuer signed */
  tbs: Uint8Array;
  hash: "SHA-256" | "SHA-384";
  /** the issuer's ECDSA signature, DER (SEQUENCE { r, s }) */
  assinatura: Uint8Array;
}

export function lerCertificado(der: Uint8Array): Certificado {
  const raiz = exigir(ler(der, 0), SEQ);
  if (raiz.fim !== der.length) throw new CertificadoInvalido("der_sobra");
  const [tbsNo, algNo, sigNo] = filhos(der, raiz);
  exigir(tbsNo, SEQ); exigir(algNo, SEQ); exigir(sigNo, BIT);
  const hash = ALGORITMOS[oid(der, filhos(der, algNo!)[0]!)];
  if (!hash) throw new CertificadoInvalido("algoritmo");

  let campos = filhos(der, tbsNo!);
  if (campos[0]?.tag === 0xa0) campos = campos.slice(1); // [0] version
  const [, sigInterna, emissorNo, validadeNo, sujeitoNo, spkiNo, ...resto] = campos; // serial, signature, issuer, validity, subject, spki
  exigir(sigInterna, SEQ);
  if (ALGORITMOS[oid(der, filhos(der, sigInterna!)[0]!)] !== hash) throw new CertificadoInvalido("algoritmo_divergente");
  const [deNo, ateNo] = filhos(der, exigir(validadeNo, SEQ));
  if (!deNo || !ateNo) throw new CertificadoInvalido("validade");

  const [algChave] = filhos(der, exigir(spkiNo, SEQ));
  const [tipoChave, curvaNo] = filhos(der, exigir(algChave, SEQ));
  if (oid(der, tipoChave!) !== "1.2.840.10045.2.1") throw new CertificadoInvalido("chave_nao_ec");
  const curva = CURVAS[oid(der, curvaNo!)];
  if (!curva) throw new CertificadoInvalido("curva");

  const extensoes = new Set<string>();
  let ca = false;
  const blocoExt = resto.find((n) => n.tag === 0xa3);
  if (blocoExt) {
    const [lista] = filhos(der, blocoExt);
    for (const ext of filhos(der, exigir(lista, SEQ))) {
      const partes = filhos(der, exigir(ext, SEQ));
      const id = oid(der, partes[0]!);
      extensoes.add(id);
      if (id === "2.5.29.19") { // basicConstraints
        const valor = exigir(partes[partes.length - 1], OCTETO);
        const seq = exigir(ler(der, valor.conteudo), SEQ);
        const primeiro = filhos(der, seq)[0];
        ca = !!primeiro && primeiro.tag === BOOL && der[primeiro.conteudo] === 0xff;
      }
    }
  }

  const bits = der.subarray(sigNo!.conteudo, sigNo!.fim);
  if (bits[0] !== 0) throw new CertificadoInvalido("bitstring");
  return {
    emissor: nome(der, emissorNo!), sujeito: nome(der, sujeitoNo!),
    validoDe: data(der, deNo), validoAte: data(der, ateNo), ca, extensoes,
    curva: curva.nome, bytesDaCurva: curva.bytes,
    spki: der.slice(spkiNo!.ini, spkiNo!.fim), tbs: der.slice(tbsNo!.ini, tbsNo!.fim),
    hash, assinatura: bits.slice(1),
  };
}

/** ECDSA DER (SEQUENCE { INTEGER r, INTEGER s }) -> the fixed-size r||s WebCrypto expects. */
export function assinaturaCrua(der: Uint8Array, bytes: number): Uint8Array {
  const seq = exigir(ler(der, 0), SEQ);
  if (seq.fim !== der.length) throw new CertificadoInvalido("ecdsa_sobra");
  const [r, s] = filhos(der, seq);
  const saida = new Uint8Array(bytes * 2);
  [r, s].forEach((n, i) => {
    let v = der.subarray(exigir(n, INT).conteudo, n!.fim);
    while (v.length > 0 && v[0] === 0) v = v.subarray(1);
    if (v.length > bytes) throw new CertificadoInvalido("ecdsa_tamanho");
    saida.set(v, i * bytes + (bytes - v.length));
  });
  return saida;
}

export function chavePublica(c: Certificado): Promise<CryptoKey> {
  return crypto.subtle.importKey("spki", c.spki, { name: "ECDSA", namedCurve: c.curva }, false, ["verify"]);
}

/** Did the holder of `emissor`'s key sign `c`? */
export async function assinadoPor(c: Certificado, emissor: Certificado): Promise<boolean> {
  let crua: Uint8Array;
  try { crua = assinaturaCrua(c.assinatura, emissor.bytesDaCurva); } catch { return false; }
  return crypto.subtle.verify({ name: "ECDSA", hash: c.hash }, await chavePublica(emissor), crua, c.tbs);
}
