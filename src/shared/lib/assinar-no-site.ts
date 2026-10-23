import { supabase } from "@/integrations/supabase/client";
import { avisar } from "./avisar";
import { abrirLinkExterno } from "./link-externo";
import { LINK_ASSINAR_SITE } from "./cobranca-loja";

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
