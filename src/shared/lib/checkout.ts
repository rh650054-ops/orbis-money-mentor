import { HOTMART_CHECKOUT_URL } from "./constants";

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
  } catch {
    /* ignore */
  }
}

/** Cupom guardado e ainda dentro da validade, ou null. */
function storedCoupon(): string | null {
  try {
    const code = localStorage.getItem(COUPON_KEY);
    const ts = Number(localStorage.getItem(COUPON_TS_KEY) || "0");
    if (code && ts && Date.now() - ts <= COUPON_MAX_AGE_MS) return code;
  } catch {
    /* ignore */
  }
  return null;
}

/** Link do checkout Hotmart já com o cupom do influenciador (se houver). */
export function getCheckoutUrl(): string {
  const code = storedCoupon();
  if (!code) return HOTMART_CHECKOUT_URL;
  const sep = HOTMART_CHECKOUT_URL.includes("?") ? "&" : "?";
  return `${HOTMART_CHECKOUT_URL}${sep}offDiscount=${encodeURIComponent(code)}`;
}
