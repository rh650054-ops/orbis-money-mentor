/* Apple subscriptions: the rules that turn what Apple SIGNED into what we store. Pure, no imports.
   Used by apple-validar, apple-webhook and apple-conciliar, so the three write the same thing.

   The principle: the state of a subscription is read from the signed transaction and the signed
   renewal info (end of the period, refund date, grace period, auto-renew), never from the name of
   the notification and never from anything the app says. The notification type only gives the label.
   The right a product gives is decided in the database (public.apple_produto), from the product id. */

export const BUNDLE_ID = "app.vant.vendas";
/** The app's numeric id in the App Store (public). Apple puts it in every Production notification. */
export const APP_APPLE_ID = 6838336105;
export const PRODUTOS = [
  "app.vant.vendas.essencial.mensal",
  "app.vant.vendas.pro.mensal",
  "app.vant.vendas.pro.anual",
  "app.vant.vendas.banco.mensal",
] as const;

/** Products Apple may still sign but the VANT does not sell yet (Rick, 27/11/2026: the bank add-on
    is out of the first iPhone version). A transaction of one of them gives no right: it is only kept
    in the ledger, so no money is ever unaccounted for. */
export const FORA_DE_VENDA: readonly string[] = ["app.vant.vendas.banco.mensal"];

export type Ambiente = "Production" | "Sandbox";

/** The fields we read from a decoded signedTransactionInfo (JWSTransactionDecodedPayload). */
export interface Transacao {
  transactionId?: string; originalTransactionId?: string; productId?: string; bundleId?: string;
  environment?: string; type?: string; appAccountToken?: string;
  purchaseDate?: number; expiresDate?: number; signedDate?: number;
  revocationDate?: number; revocationReason?: number;
  price?: number; currency?: string; transactionReason?: string; isUpgraded?: boolean;
  storefront?: string; offerType?: number;
}
/** The fields we read from a decoded signedRenewalInfo (JWSRenewalInfoDecodedPayload). */
export interface Renovacao {
  originalTransactionId?: string; autoRenewStatus?: number; autoRenewProductId?: string;
  gracePeriodExpiresDate?: number; isInBillingRetryPeriod?: boolean; expirationIntent?: number;
  environment?: string; signedDate?: number;
}
/** The fields we read from a decoded notification (ResponseBodyV2DecodedPayload). */
export interface Notificacao {
  notificationType?: string; subtype?: string; notificationUUID?: string; signedDate?: number;
  data?: { environment?: string; bundleId?: string; appAppleId?: number; signedTransactionInfo?: string; signedRenewalInfo?: string; status?: number };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
export const ehAmbiente = (v: unknown): v is Ambiente => v === "Production" || v === "Sandbox";
const iso = (ms: number | undefined | null): string | null =>
  typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;

/** The middle part of a JWS, decoded WITHOUT checking the signature. Only to choose which
    environment's verifier to use; the verifier then refuses the JWS if the claim does not match. */
export function espiar(jws: unknown): Record<string, unknown> | null {
  if (typeof jws !== "string") return null;
  const partes = jws.split(".");
  if (partes.length !== 3 || !partes[1]) return null;
  try {
    const b64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const txt = new TextDecoder().decode(Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0)));
    const o = JSON.parse(txt);
    return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
  } catch { return null; }
}

/** Environment a JWS declares (transaction and renewal info carry it at the top; a notification
    inside `data`). Unverified: see espiar. */
export function ambienteDeclarado(jws: unknown): Ambiente | null {
  const o = espiar(jws);
  if (!o) return null;
  const direto = o.environment;
  if (ehAmbiente(direto)) return direto;
  for (const k of ["data", "summary", "appData"]) {
    const d = o[k] as { environment?: unknown } | undefined;
    if (d && ehAmbiente(d.environment)) return d.environment;
  }
  return null;
}

/** The VANT account the purchase was made for: the app sets appAccountToken = the account id when
    it starts the purchase, and Apple signs it. Anything that is not a uuid is "no token". */
export function donoPeloToken(t: Transacao | null | undefined): string | null {
  const tok = t?.appAccountToken;
  return ehUuid(tok) ? tok.toLowerCase() : null;
}

/** Label of the state, for support. It never decides access. */
export function rotulo(t: Transacao, r: Renovacao | null, agoraMs: number): string {
  if (t.revocationDate) return "reembolsada";
  const fim = t.expiresDate ?? 0;
  const carencia = r?.gracePeriodExpiresDate ?? 0;
  if (fim > agoraMs) return r && r.autoRenewStatus === 0 ? "renovacao_desligada" : "ativa";
  if (carencia > agoraMs) return "em_carencia";
  if (r?.isInBillingRetryPeriod) return "cobranca_falhou";
  return "expirada";
}

export interface Estado {
  p_original: string; p_produto: string; p_ambiente: Ambiente; p_expira: string; p_assinado: string;
  p_status: string; p_tolerancia: string | null; p_renova: boolean | null; p_revogada: string | null; p_transacao: string | null;
}
export type Recusa = { erro: "nao_e_assinatura" | "produto_desconhecido" | "produto_fora_de_venda" | "transacao_incompleta" | "ambiente_invalido" | "app_diferente" };

/** Arguments of public.apple_assinatura_gravar, from the signed documents.
    assinadoMs = when Apple signed what we are acting on (the notification, or the transaction). */
export function estado(t: Transacao, r: Renovacao | null, assinadoMs: number | undefined, agoraMs = Date.now()): Estado | Recusa {
  if (t.bundleId !== BUNDLE_ID) return { erro: "app_diferente" };
  if (t.type !== "Auto-Renewable Subscription") return { erro: "nao_e_assinatura" };
  if (!t.productId || !(PRODUTOS as readonly string[]).includes(t.productId)) return { erro: "produto_desconhecido" };
  if (FORA_DE_VENDA.includes(t.productId)) return { erro: "produto_fora_de_venda" };
  if (!ehAmbiente(t.environment)) return { erro: "ambiente_invalido" };
  const expira = iso(t.expiresDate);
  const assinado = iso(assinadoMs ?? t.signedDate);
  if (!t.originalTransactionId || !expira || !assinado) return { erro: "transacao_incompleta" };
  // renewal info of ANOTHER subscription says nothing about this one
  const ren = r && (!r.originalTransactionId || r.originalTransactionId === t.originalTransactionId) ? r : null;
  const carencia = ren?.gracePeriodExpiresDate && ren.gracePeriodExpiresDate > (t.expiresDate ?? 0) ? iso(ren.gracePeriodExpiresDate) : null;
  return {
    p_original: t.originalTransactionId, p_produto: t.productId, p_ambiente: t.environment,
    p_expira: expira, p_assinado: assinado, p_status: rotulo(t, ren, agoraMs),
    p_tolerancia: t.revocationDate ? null : carencia,
    p_renova: ren && typeof ren.autoRenewStatus === "number" ? ren.autoRenewStatus === 1 : null,
    p_revogada: iso(t.revocationDate), p_transacao: t.transactionId ?? null,
  };
}

export interface LinhaFinanceira {
  p_transacao: string; p_original: string; p_user: string | null; p_produto: string; p_ambiente: Ambiente;
  p_comprado: string; p_periodo_ate: string | null; p_preco_milesimos: number | null; p_moeda: string | null; p_motivo: string | null;
  p_reembolsado: string | null; p_reembolso_motivo: string | null; p_substituida: boolean; p_loja: string | null; p_oferta: string | null; p_assinado: string | null;
}

/** Arguments of public.apple_transacao_registrar (the ledger), or null when the transaction cannot
    be a row there. The price is what Apple signed, in thousandths of the currency unit. */
export function linhaFinanceira(t: Transacao, user: string | null, assinadoMs?: number): LinhaFinanceira | null {
  const comprado = iso(t.purchaseDate);
  if (!t.transactionId || !t.originalTransactionId || !comprado || !ehAmbiente(t.environment)) return null;
  if (!t.productId || !(PRODUTOS as readonly string[]).includes(t.productId)) return null;
  const preco = typeof t.price === "number" && Number.isInteger(t.price) && t.price >= 0 ? t.price : null;
  return {
    p_transacao: t.transactionId, p_original: t.originalTransactionId, p_user: user, p_produto: t.productId, p_ambiente: t.environment,
    p_comprado: comprado, p_periodo_ate: iso(t.expiresDate), p_preco_milesimos: preco, p_moeda: preco === null ? null : (t.currency ?? null),
    p_motivo: t.transactionReason ?? null, p_reembolsado: iso(t.revocationDate),
    p_reembolso_motivo: t.revocationDate ? String(t.revocationReason ?? "") || null : null,
    p_substituida: t.isUpgraded === true, p_loja: t.storefront ?? null,
    p_oferta: typeof t.offerType === "number" ? String(t.offerType) : null, p_assinado: iso(assinadoMs ?? t.signedDate),
  };
}

/** What may go to the function logs: technical identifiers only (never a JWS, a token or a payload). */
export function linhaDeLog(o: { tipo?: unknown; subtipo?: unknown; uuid?: unknown; original?: unknown; transacao?: unknown; ambiente?: unknown; resultado?: unknown; user?: unknown }): string {
  const limpo = (v: unknown) => (v === null || v === undefined ? null : String(v).replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 80) || null);
  return JSON.stringify({
    tipo: limpo(o.tipo), subtipo: limpo(o.subtipo), uuid: limpo(o.uuid), original: limpo(o.original), transacao: limpo(o.transacao),
    ambiente: limpo(o.ambiente), resultado: limpo(o.resultado), user: ehUuid(o.user) ? o.user : null,
  });
}
