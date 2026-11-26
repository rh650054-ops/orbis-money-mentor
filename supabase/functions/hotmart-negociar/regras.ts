/* "Gerar Pix" (Rick, 26/11/2026). Pure rules (tested) of the official Hotmart installment
   negotiation for an overdue subscription. Nothing here talks to Hotmart or to the database.
     · what Hotmart's purchase history says is pending (the LAST overdue recurrence only);
     · whether a Pix may be asked at all (never for Pix Automático, a closed or paid subscription,
       or a subscriber that is not the buyer linked to the account);
     · how to read Hotmart's answer without ever risking a second charge;
     · until when a negotiated payment gives access (never "30 new days" by default). */
import { mesmoTitular } from "../hotmart-conciliar/regras.ts";

export interface Compra { transaction?: string; status?: string; recurrency_number?: number; payment_type?: string;
  price?: { value?: number; currency_code?: string } }

/** Hotmart answers the purchase history as a list, as { items: [...] } or (sandbox, 26/11) as ONE object. */
export function listaDeCompras(corpo: unknown): Compra[] {
  if (Array.isArray(corpo)) return corpo as Compra[];
  if (corpo && typeof corpo === "object") {
    const itens = (corpo as { items?: unknown }).items;
    if (Array.isArray(itens)) return itens as Compra[];
    if ("transaction" in corpo || "recurrency_number" in corpo) return [corpo as Compra];
  }
  return [];
}

const PAGA = new Set(["APPROVED", "COMPLETE", "COMPLETED"]);
export interface Pendencia { recorrencia: number; valor: number | null; status: string | null; atrasadas: number[] }

/** The last recurrence, when it is not paid. A recurrence is paid when ANY of its transactions is
    approved (an expired Pix and its paid retry share the number). null = nothing pending. */
export function recorrenciaPendente(compras: Compra[]): Pendencia | null {
  const porNumero = new Map<number, Compra[]>();
  for (const c of compras) {
    const n = Number(c.recurrency_number);
    if (Number.isInteger(n) && n > 0) porNumero.set(n, [...(porNumero.get(n) ?? []), c]);
  }
  if (porNumero.size === 0) return null;
  const paga = (n: number) => (porNumero.get(n) ?? []).some((c) => PAGA.has((c.status ?? "").toUpperCase()));
  const ultima = Math.max(...porNumero.keys());
  if (paga(ultima)) return null;
  const doUltimo = porNumero.get(ultima) ?? [];
  const comPreco = doUltimo.find((c) => Number.isFinite(Number(c.price?.value)) && (c.price?.currency_code ?? "BRL") === "BRL");
  return { recorrencia: ultima, valor: comPreco ? Number(comPreco.price?.value) : null, status: doUltimo[0]?.status ?? null,
    atrasadas: [...porNumero.keys()].filter((n) => !paga(n)).sort((a, b) => a - b) };
}

export interface Nossa { subscription_id: string; status_hotmart: string | null; forma_pagamento?: string | null; email?: string | null }
export interface Real { subscription_id?: number | null; status?: string | null; date_next_charge?: number | null; email?: string | null }
export type Motivo = "pix_automatico" | "em_dia" | "encerrada" | "titular_nao_confere" | "sem_numero_da_assinatura" | "sem_pendencia" | "sem_valor";
export type Pedido = { acao: "negociar"; hotmart_id: number; recorrencia: number; valor: number; proxima_cobranca: string | null; atrasadas: number[] }
  | { acao: "recusar"; motivo: Motivo };

const ATRASADA = new Set(["PAST_DUE", "DELAYED", "OVERDUE"]);

/** May VANT ask Hotmart for a Pix of this subscription, and of which recurrence? */
export function decidirPedido(nossa: Nossa, real: Real, compras: Compra[]): Pedido {
  // first version: Pix Automático stays out (the bank may retry the debit while the person pays the Pix)
  if ((nossa.forma_pagamento ?? "").toUpperCase() === "PIX_AUTOMATIC") return { acao: "recusar", motivo: "pix_automatico" };
  const status = (real.status ?? "").toUpperCase();
  if (status === "ACTIVE") return { acao: "recusar", motivo: "em_dia" };
  if (!ATRASADA.has(status)) return { acao: "recusar", motivo: "encerrada" };
  if (!mesmoTitular(nossa.email, real.email)) return { acao: "recusar", motivo: "titular_nao_confere" };
  const id = Number(real.subscription_id);
  if (!Number.isInteger(id) || id <= 0) return { acao: "recusar", motivo: "sem_numero_da_assinatura" };
  const p = recorrenciaPendente(compras);
  if (!p) return { acao: "recusar", motivo: "sem_pendencia" };
  if (p.valor === null || p.valor <= 0) return { acao: "recusar", motivo: "sem_valor" };
  const prox = Number(real.date_next_charge);
  return { acao: "negociar", hotmart_id: id, recorrencia: p.recorrencia, valor: p.valor,
    proxima_cobranca: Number.isFinite(prox) && prox > 0 ? new Date(prox).toISOString() : null, atrasadas: p.atrasadas };
}

/** CRC16-CCITT (0x1021, init 0xFFFF), the check digits of a Pix "copia e cola" (BR Code). */
function crc16(s: string): string {
  let crc = 0xffff;
  for (const ch of new TextEncoder().encode(s)) {
    crc ^= ch << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function campos(s: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i + 4 <= s.length;) {
    const n = Number(s.slice(i + 2, i + 4));
    if (!Number.isInteger(n)) break;
    o[s.slice(i, i + 2)] = s.slice(i + 4, i + 4 + n);
    i += 4 + n;
  }
  return o;
}
/** Is this a well-formed Pix copia e cola, and which amount does it carry (null = open amount)? */
export function lerPix(codigo: unknown): { valido: boolean; valor: number | null } {
  if (typeof codigo !== "string" || codigo.length < 20) return { valido: false, valor: null };
  const c = campos(codigo);
  const valido = c["00"] === "01" && codigo.slice(-8, -4) === "6304" && crc16(codigo.slice(0, -4)) === codigo.slice(-4).toUpperCase();
  const v = Number(c["54"]);
  return { valido, valor: valido && c["54"] && Number.isFinite(v) ? v : null };
}

export interface RespostaHotmart { transaction?: string; payment?: { type?: string; expiration_date?: number; pix_code?: string; pix_qrcode?: string } }
export type Resultado = { resultado: "gerado"; transacao: string; pix_code: string; pix_qrcode: string | null; vence_em: string | null; valor_no_pix: number | null }
  | { resultado: "falhou" | "incerto"; erro: string };

/** Reads Hotmart's answer to the negotiation request.
      gerado  → a Pix came back with its transaction;
      falhou  → Hotmart REFUSED the request (4xx): no charge exists, asking again is safe;
      incerto → no answer, a server error, or an answer without a usable Pix: a charge MAY exist
                at Hotmart, so nothing is asked again until that is checked. */
export function lerResposta(http: number | null, corpo: unknown): Resultado {
  if (http === null) return { resultado: "incerto", erro: "sem resposta da Hotmart" };
  if (http >= 400 && http < 500 && http !== 408) {
    const e = corpo as { error?: unknown; error_description?: unknown } | null;
    return { resultado: "falhou", erro: `http ${http} ${String(e?.error ?? "")} ${String(e?.error_description ?? "")}`.trim().slice(0, 200) };
  }
  if (http < 200 || http >= 300) return { resultado: "incerto", erro: `http ${http}` };
  const r = (corpo ?? {}) as RespostaHotmart;
  const pix = r.payment?.pix_code;
  if (!r.transaction || typeof pix !== "string" || !lerPix(pix).valido) {
    return { resultado: "incerto", erro: `resposta sem Pix valido (tipo ${String(r.payment?.type ?? "?")}, transacao ${r.transaction ? "sim" : "nao"})` };
  }
  const vence = Number(r.payment?.expiration_date);
  return { resultado: "gerado", transacao: String(r.transaction), pix_code: pix, pix_qrcode: r.payment?.pix_qrcode ? String(r.payment.pix_qrcode) : null,
    vence_em: Number.isFinite(vence) && vence > 0 ? new Date(vence).toISOString() : null, valor_no_pix: lerPix(pix).valor };
}

/** Until when does a paid negotiation give access? The subscription's own next charge: the one in
    the payment event, else the one read when the Pix was generated. Never "now + 30 days": paying
    an OLD recurrence does not open a new month. null = no proven date → nothing is released
    automatically; "Já paguei, verificar" asks Hotmart. */
export function fimDoAcessoNegociado(proximaNoEvento: unknown, proximaGuardada: string | null | undefined, agora = new Date()): string | null {
  for (const ms of [Number(proximaNoEvento), proximaGuardada ? Date.parse(proximaGuardada) : NaN]) {
    if (Number.isFinite(ms) && ms > agora.getTime() && ms < agora.getTime() + 400 * 86_400_000) return new Date(ms).toISOString();
  }
  return null;
}
