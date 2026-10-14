import { Capacitor } from "@capacitor/core";

/*
 * Where is VANT running?
 *  - "web":     browser / installed PWA (app.orbis.inf.br). Hotmart checkout allowed.
 *  - "android": Play Store build.
 *  - "ios":     App Store build.
 *
 * How the store build handles subscriptions lives in cobranca-loja.ts
 * (modoCobranca): every checkout goes through abrirCheckout, which respects it.
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
