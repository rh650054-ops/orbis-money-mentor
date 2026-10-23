import { HOTMART_CHECKOUT_URL } from "./constants";
import { avisar } from "@/shared/lib/avisar";
import { validateCPF } from "@/shared/lib/cpf-validation";
import { EVENTO_ASSINATURA_LOJA, modoCobranca } from "./cobranca-loja";
import { abrirAssinarNoSite } from "./assinar-no-site";

// Atribuição de influenciador por cupom, mesmo com o teste grátis no app.
// Quando a pessoa entra pelo link do influenciador (ex: ".../?cupom=ZECK15"),
// guardamos o código no aparelho. Lá na hora de assinar (mesmo dias depois),
// o checkout já abre com o cupom aplicado sozinho — o usuário não precisa lembrar.
const COUPON_KEY = "orbis_ref_coupon";
const COUPON_TS_KEY = "orbis_ref_coupon_ts";
const COUPON_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 dias

/** Lê o cupom/ref da URL e guarda no aparelho. Chamar uma vez, no boot do app. */
export function captureReferralCoupon(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw =
      params.get("cupom") ||
      params.get("coupon") ||
      params.get("ref") ||
      params.get("offDiscount");
    const code = (raw ?? "").trim().toUpperCase();
    if (code) {
      localStorage.setItem(COUPON_KEY, code);
      localStorage.setItem(COUPON_TS_KEY, String(Date.now()));
    }
  } catch (e) {
    avisar.silencioso("checkout: guardar cupom", e);
  }
}

/** Cupom guardado e ainda dentro da validade, ou null. */
function storedCoupon(): string | null {
  try {
    const code = localStorage.getItem(COUPON_KEY);
    const ts = Number(localStorage.getItem(COUPON_TS_KEY) || "0");
    if (code && ts && Date.now() - ts <= COUPON_MAX_AGE_MS) return code;
  } catch (e) {
    avisar.silencioso("checkout: ler cupom", e);
  }
  return null;
}

/** Guarda o código do parceiro no aparelho (usado quando a conta devolve o dono). */
export function setReferralCode(code: string): void {
  try {
    localStorage.setItem(COUPON_KEY, code);
    localStorage.setItem(COUPON_TS_KEY, String(Date.now()));
  } catch (e) {
    avisar.silencioso("checkout: guardar cupom da conta", e);
  }
}

/** Código do influenciador guardado no aparelho (ou null). Usado também no cadastro. */
export function getReferralCode(): string | null {
  return storedCoupon();
}

/** Link do checkout Hotmart já com o cupom do influenciador (se houver). */
export function getCheckoutUrl(): string {
  const code = storedCoupon();
  if (!code) return HOTMART_CHECKOUT_URL;
  // O sck viaja até a Hotmart e VOLTA no webhook de venda — é o que fecha a
  // comissão sozinha, mesmo se a pessoa pagar com outro e-mail.
  const url = HOTMART_CHECKOUT_URL.replace("sck=orbis_app", `sck=${encodeURIComponent(code)}`);
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}offDiscount=${encodeURIComponent(code)}`;
}

/* VANT PRO (02/10/2026): two offers of the same Hotmart product. hotmart-webhook
   tells them apart by offer.code and turns the Pro on (monthly 30d, annual 365d). */
export const PRO_CHECKOUT = {
  anual: "https://pay.hotmart.com/N104683123F?off=ew11enu0&checkoutMode=6",
  mensal: "https://pay.hotmart.com/N104683123F?off=5y86n311&checkoutMode=6",
} as const;
export type PlanoPro = keyof typeof PRO_CHECKOUT;

/** Pro checkout link. Only the sck (partner attribution) travels: a coupon would
 *  swap the offer for another code the webhook does not know as Pro. */
export function getProCheckoutUrl(plano: PlanoPro): string {
  const code = storedCoupon();
  return `${PRO_CHECKOUT[plano]}&sck=${encodeURIComponent(code ?? "vant_pro")}`;
}

/** Banco Open Finance: +R$ 12,90/mês cada (planos de 06/10/2026). Essencial + banco = R$ 42,80;
 *  o Pro mensal inclui 1 banco e o Pro anual 2 — o avulso soma em cima.
 *  Oferta 3nnrr1xn (R$ 12,90, desde 06/10; a otgozkn9 de R$ 10 fica só pras cortesias).
 *  O hotmart-webhook reconhece as duas e libera
 *  1 vaga por assinatura ativa (banco_extra_registrar → open_finance_limite). */
export const BANCO_EXTRA_CHECKOUT: string | null = "https://pay.hotmart.com/N104683123F?off=3nnrr1xn&checkoutMode=6";

/* ===== RENEWING WITHOUT LEAVING THE APP STRANDED (13/10/2026) =====
   Rick: "to renew, the user leaves the app and often can't renew". Two fixes live
   here: every checkout link carries who is buying (so the webhook finds the
   account even if the buyer types another e-mail), and every link opens the same
   way (new tab, falling back to the same window when the popup is blocked). */

/** Who is buying. Every field is optional; missing or invalid ones are skipped. */
export type IdentidadeCheckout = {
  email?: string | null;
  nome?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  /** auth user id: goes as `xcod` and comes back in the webhook (purchase.origin.xcod) */
  userId?: string | null;
};

/** CPF sign-ups log in with a synthetic `<cpf>@orbis.internal` e-mail: never prefill it. */
export const emailReal = (e?: string | null): string | null => {
  const v = (e ?? "").trim();
  return v.includes("@") && !v.toLowerCase().endsWith("@orbis.internal") ? v : null;
};

/** Brazilian phone → Hotmart's phoneac (DDD) + phonenumber. Null when not a clean BR number. */
function telefoneBR(t?: string | null): { ddd: string; numero: string } | null {
  let d = (t ?? "").replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return { ddd: d.slice(0, 2), numero: d.slice(2) };
}

/** Appends Hotmart prefill params (email, name, doc, phoneac, phonenumber, xcod) to a
 *  checkout URL. Never touches off/sck/offDiscount/checkoutMode and never duplicates a
 *  param the link already has (an explicit value wins). */
export function comIdentidade(url: string, id: IdentidadeCheckout): string {
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  const p = u.searchParams;
  const por = (k: string, v: string | null | undefined) => { if (v && !p.has(k)) p.set(k, v); };
  por("email", emailReal(id.email));
  por("name", id.nome?.trim());
  const cpf = (id.cpf ?? "").replace(/\D/g, "");
  if (validateCPF(cpf)) por("doc", cpf);
  const tel = telefoneBR(id.telefone);
  if (tel) { por("phoneac", tel.ddd); por("phonenumber", tel.numero); }
  por("xcod", id.userId?.trim());
  return u.toString();
}

// The paywalls watch this to re-check the subscription when the buyer comes back.
const CHECKOUT_ABERTO_KEY = "vant_checkout_aberto_em";
export const EVENTO_CHECKOUT_ABERTO = "vant:checkout-aberto";

/** When the user last opened a checkout (ms), or null. Survives a full reload. */
export function checkoutAbertoEm(): number | null {
  try {
    const n = Number(localStorage.getItem(CHECKOUT_ABERTO_KEY) || "0");
    return n > 0 ? n : null;
  } catch { return null; }
}

export function limparCheckoutAberto(): void {
  try { localStorage.removeItem(CHECKOUT_ABERTO_KEY); } catch { /* private mode */ }
}

function marcarCheckoutAberto(): void {
  const agora = Date.now();
  try { localStorage.setItem(CHECKOUT_ABERTO_KEY, String(agora)); } catch { /* private mode */ }
  try { window.dispatchEvent(new CustomEvent(EVENTO_CHECKOUT_ABERTO, { detail: agora })); } catch { /* old browser */ }
}

/** The ONE way to open a checkout. New tab; if the browser refuses (popup blocked,
 *  iOS standalone quirks) it falls back to the same window so the tap never "does
 *  nothing". The "noopener" feature is NOT passed: with it, window.open always
 *  returns null by spec and the fallback would always replace the app — the
 *  opener is cut by hand instead. */
export function abrirCheckout(url: string): void {
  // app da loja: nunca abre a Hotmart. "link" (Néctar) abre a página de planos do site
  // no navegador do celular; "fora" mostra o aviso neutro.
  const modo = modoCobranca();
  if (modo === "link") { marcarCheckoutAberto(); void abrirAssinarNoSite(); return; }
  if (modo === "fora") {
    window.dispatchEvent(new CustomEvent(EVENTO_ASSINATURA_LOJA));
    return;
  }
  marcarCheckoutAberto();
  let janela: Window | null = null;
  try {
    janela = window.open(url, "_blank");
    if (janela) janela.opener = null;
  } catch (e) {
    avisar.silencioso("checkout: abrir nova aba", e);
  }
  if (!janela) window.location.href = url;
}

/** onClick for an `<a href target=_blank>` checkout link: keeps the link accessible
 *  (long-press, screen readers) but routes the tap through abrirCheckout. */
export function aoClicarCheckout(e: { preventDefault: () => void; currentTarget: { href: string } }): void {
  e.preventDefault();
  abrirCheckout(e.currentTarget.href);
}
