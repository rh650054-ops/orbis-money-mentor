// email-confirmar-link — confirma o e-mail com 1 clique (link enviado no cadastro).
// GET ?t=<token>. Sem login (verify_jwt = false): a prova e o proprio token,
// aleatorio (24 bytes), guardado so como sha256, valido por 24h, uso unico, e so
// vale para o e-mail que ainda esta no perfil (trocou o e-mail = link morto).
// Sucesso -> redireciona pro app com ?email=confirmado.
// Falha (expirado/invalido/usado) -> redireciona pro card nas Configuracoes,
// onde a pessoa pede um codigo novo. Nunca mostra erro tecnico.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { sha256Hex } from "../_shared/email.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "https://app.orbis.inf.br";
const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to } });

Deno.serve(async (req) => {
  const fallback = `${APP_URL}/settings?confirmar=email`;
  try {
    const token = new URL(req.url).searchParams.get("t") ?? "";
    if (!/^[0-9a-f]{48}$/.test(token)) return redirect(fallback);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hash = await sha256Hex(`link:${token}`);

    // confere, consome e confirma numa transacao so, preso ao e-mail ATUAL do perfil
    const { data: status, error } = await admin.rpc("email_confirmar_link", { p_hash: hash });
    if (error || status !== "ok") return redirect(fallback);
    return redirect(`${APP_URL}/?email=confirmado`);
  } catch (e) {
    console.error("email-confirmar-link:", (e as Error)?.message ?? "erro");
    return redirect(fallback);
  }
});
