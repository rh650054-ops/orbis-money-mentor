// VANT — server-side AI consent gate (26/11/2026, App Store 5.1.1(i) / 5.1.2(i) + LGPD art. 8).
//
// Every edge function that sends a vendor's data to a third-party AI (Anthropic, OpenAI,
// Google Gemini, Cerebras) calls this BEFORE reading or forwarding anything. The answer comes
// from public.consentimento_ia, read with the vendor's own JWT (RLS: owner only), so the app
// cannot fake it. Valid only for the CURRENT disclosure version (consentimento-ia-regra.ts):
// a permission given on an older text, no row, "Agora não", a revocation, no login or any error
// → false (fails closed). Granting is only possible through responder_consentimento_ia with the
// version (migration 20261126160000); a write from an older app version never carries one. The app has the same gate in its fetch (src/shared/lib/consentimento-ia.ts);
// this one also covers old app versions and any caller outside the app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { consentimentoValido } from "./consentimento-ia-regra.ts";

export async function iaPermitidaNoServidor(authHeader: string): Promise<boolean> {
  if (!authHeader.startsWith("Bearer ")) return false;
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await supa.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return false;
    const { data, error } = await supa.from("consentimento_ia").select("permitido, versao").eq("user_id", uid).maybeSingle();
    if (error) return false;
    return consentimentoValido(data);
  } catch {
    return false;
  }
}

export function respostaSemConsentimentoIa(cors: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: "ia_sem_consentimento",
      message: "A IA está desligada ou precisa de uma nova autorização. Autorize em Minha Conta › Inteligência artificial.",
    }),
    { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
  );
}

/** Admin tools that send ANOTHER vendor's data to the AI (fraud check): that vendor's own
 *  permission is what counts, read with the service role. Fails closed. */
export async function iaPermitidaParaUsuario(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data, error } = await admin.from("consentimento_ia").select("permitido, versao").eq("user_id", userId).maybeSingle();
    if (error) return false;
    return consentimentoValido(data);
  } catch {
    return false;
  }
}
