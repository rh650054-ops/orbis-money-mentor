import { Capacitor } from "@capacitor/core";

/*
 * Where is VANT running?
 *  - "web":     browser / installed PWA (app.orbis.inf.br). Hotmart checkout allowed.
 *  - "android": Play Store build. Subscriptions MUST go through Google Play Billing
 *               (Brazil is not in Google's billing-choice program as of 10/2026).
 *  - "ios":     App Store build. Subscriptions go through Apple In-App Purchase.
 *
 * Every place that opens a Hotmart link must check `podeUsarCheckoutWeb()` first;
 * a Hotmart link inside a store build gets the app rejected.
 */
export type Plataforma = "web" | "android" | "ios";

export function plataforma(): Plataforma {
  try {
    if (!Capacitor.isNativePlatform()) return "web";
    const p = Capacitor.getPlatform();
    return p === "ios" ? "ios" : "android";
  } catch {
    return "web";
  }
}

/** True inside the Play Store / App Store binary. */
export function ehAppDaLoja(): boolean {
  return plataforma() !== "web";
}

/** Hotmart (or any web checkout) may only be offered on the web build. */
export function podeUsarCheckoutWeb(): boolean {
  return plataforma() === "web";
}
