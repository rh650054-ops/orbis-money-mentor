import { supabase } from "@/integrations/supabase/client";
import { temAcessoPago } from "@/shared/lib/assinatura";

/** Asks the server whether the logged-in user has paid access right now (same rule as
 *  useSubscription). Used by the "Já paguei" buttons and the return-from-checkout
 *  re-check. Throws when not logged in or the read fails. */
export async function verificarAcessoPago(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  // server-side whitelist may flip profile flags; never blocks the check
  try { await supabase.functions.invoke("check-admin-access"); } catch { /* segue */ }

  const [{ data: perfil, error: pErr }, { data: sub, error: sErr }] = await Promise.all([
    supabase.from("profiles").select("plan_status, is_demo, billing_exempt").eq("user_id", user.id).maybeSingle(),
    supabase.from("subscriptions").select("status, grace_until").eq("user_id", user.id).maybeSingle(),
  ]);
  if (pErr) throw pErr;
  if (sErr) throw sErr;
  return temAcessoPago(perfil, sub);
}
