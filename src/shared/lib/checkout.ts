import { HOTMART_CHECKOUT_URL } from "./constants";
import { avisar } from "@/shared/lib/avisar";

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
 *  Oferta otgozkn9 do produto Vant: o hotmart-webhook reconhece a oferta e libera
 *  1 vaga por assinatura ativa (banco_extra_registrar → open_finance_limite). */
export const BANCO_EXTRA_CHECKOUT: string | null = "https://pay.hotmart.com/N104683123F?off=otgozkn9&checkoutMode=6";
