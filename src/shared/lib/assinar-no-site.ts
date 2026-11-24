import { supabase } from "@/integrations/supabase/client";
import { avisar } from "./avisar";
import { abrirLinkExterno } from "./link-externo";
import { LINK_ASSINAR_SITE } from "./cobranca-loja";
import { linkDeRenovacao } from "./renovar-assinatura";

/** The store app's "Assinar": asks the server for a 30-minute token and opens
 *  app.vantapp.com.br/assinar?t=… in the phone browser, so the page knows who is
 *  subscribing without a second login. Without a session (or on error) it opens the
 *  plain plans page. */
export const PAGINA_ASSINAR = "https://app.vantapp.com.br/assinar";

export async function abrirAssinarNoSite(): Promise<void> {
  let url = LINK_ASSINAR_SITE;
  try {
    const { data, error } = await supabase.rpc("assinar_token_criar" as never);
    if (!error && typeof data === "string" && data) url = `${PAGINA_ASSINAR}?t=${encodeURIComponent(data)}`;
  } catch (e) { avisar.silencioso("assinar no site: token", e); }
  await abrirLinkExterno(url);
}

/** "Renovar assinatura": straight to the Hotmart checkout of the plan the vendor had; if the
 *  plan cannot be told for sure, the plans page (abrirAssinarNoSite). */
export async function abrirRenovarNoSite(): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    const url = u ? await linkDeRenovacao(u.id, u.email ?? null) : null;
    if (url) { await abrirLinkExterno(url); return; }
  } catch (e) { avisar.silencioso("renovar no site", e); }
  await abrirAssinarNoSite();
}
