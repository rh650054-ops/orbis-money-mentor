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

/** Public web address of the app. Inside the store app `window.location.origin` is
 *  `https://localhost`, so links built from it (share, e-mail redirects) would be dead. */
export const URL_APP = "https://app.vantapp.com.br";
export function urlPublica(caminho = "/"): string {
  const origem = typeof window !== "undefined" && !ehAppDaLoja() && /^https?:/.test(window.location.origin)
    ? window.location.origin : URL_APP;
  return `${origem}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}
