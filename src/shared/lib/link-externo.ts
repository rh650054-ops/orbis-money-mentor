import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { avisar } from "./avisar";

/** Opens a URL outside the app. In the store binary it is the system browser
 *  (Safari / Chrome sheet), which is what Apple and Google expect for a link that
 *  leaves the app; on the web it is a normal new tab. */
export async function abrirLinkExterno(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try { await Browser.open({ url, presentationStyle: "popover" }); return; }
    catch (e) { avisar.silencioso("link externo: Browser.open", e); }
  }
  let janela: Window | null = null;
  try { janela = window.open(url, "_blank"); if (janela) janela.opener = null; }
  catch (e) { avisar.silencioso("link externo: window.open", e); }
  if (!janela) window.location.href = url;
}

/** The CRM (public/crm.html) is a separate page: inside the store app opening "/crm.html"
 *  would navigate the WebView away from the SPA, so there it opens the site's copy. */
export async function abrirCrm(): Promise<void> {
  if (Capacitor.isNativePlatform()) return abrirLinkExterno("https://app.vantapp.com.br/crm.html");
  window.open("/crm.html", "_blank", "noopener");
}
