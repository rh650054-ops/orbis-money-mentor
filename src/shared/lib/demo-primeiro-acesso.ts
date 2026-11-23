/* Demo / store-review accounts (CRM › Admin › Demo) are created without going through the
 * sign-up form, so the login used to drop them straight on the dashboard and the onboarding
 * never showed (Rick, 23/11/2026). Rule: a demo account that never started the onboarding
 * (onboarding_step 0, not completed) goes to /onboarding-novo on login. Once it moves past the
 * first step, logins go to the dashboard as usual. Other accounts: unchanged. */
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "./avisar";

export async function demoNoPrimeiroAcesso(uid: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("profiles")
      .select("is_demo, onboarding_completed, onboarding_step").eq("user_id", uid).maybeSingle();
    if (error) throw error;
    const p = data as { is_demo?: boolean | null; onboarding_completed?: boolean | null; onboarding_step?: number | null } | null;
    return p?.is_demo === true && p.onboarding_completed !== true && (p.onboarding_step ?? 0) === 0;
  } catch (e) {
    avisar.silencioso("demo: primeiro acesso", e);
    return false;
  }
}
