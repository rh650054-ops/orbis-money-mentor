// email-confirmar — confirma o e-mail pessoal do usuario logado com codigo de 6 digitos.
// Exige JWT (verify_jwt = true). Acoes:
//   { acao: "enviar", email?: string }  -> grava/atualiza o e-mail do perfil e manda o codigo
//   { acao: "confirmar", codigo: string } -> confere o codigo e marca profiles.email_verificado_em
//
// Seguranca:
//  - so o proprio usuario (pelo JWT) mexe no proprio e-mail;
//  - codigo nunca e gravado em claro (sha256), expira em 15 min, max 5 tentativas;
//  - freio: 3 envios por usuario a cada 60 min (cadastro_pode_tentar, service_role only);
//  - trocar o e-mail zera a confirmacao (email_verificado_em = NULL).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { enviarEmail, layoutEmail, gerarCodigo6, sha256Hex, EMAIL_RE } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const acao = String(body?.acao ?? "");

    if (acao === "enviar") {
      // 1. e-mail: o enviado agora, ou o que ja esta no perfil
      let email: string | null = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
      const { data: perfil } = await admin.from("profiles").select("email").eq("user_id", user.id).single();
      if (!email) email = (perfil?.email ?? "").trim().toLowerCase() || null;
      if (!email || !EMAIL_RE.test(email)) return json({ error: "Informe um e-mail válido." }, 400);

      // 2. freio por usuario
      const { data: pode } = await admin.rpc("cadastro_pode_tentar", { p_chave: `mail:${user.id}`, p_teto: 3, p_janela_min: 60 });
      if (pode === false) return json({ error: "Muitos envios. Tente de novo em 1 hora." }, 429);

      // 3. e-mail mudou? grava e zera a confirmacao
      if (email !== (perfil?.email ?? "").trim().toLowerCase()) {
        await admin.from("profiles").update({ email, email_verificado_em: null }).eq("user_id", user.id);
      }

      // 4. codigo (hash) com validade de 15 min
      const codigo = gerarCodigo6();
      const { error: upErr } = await admin.from("email_codigos").upsert({
        user_id: user.id,
        email,
        codigo_hash: await sha256Hex(`${user.id}:${codigo}`),
        expira_em: new Date(Date.now() + 15 * 60_000).toISOString(),
        tentativas: 0,
        enviado_em: new Date().toISOString(),
      });
      if (upErr) throw upErr;

      await enviarEmail({
        to: email,
        subject: `${codigo} é o seu código da Vant`,
        html: layoutEmail(
          "Confirme seu e-mail",
          `<p>Use este código no app pra confirmar que este e-mail é seu:</p>
           <p style="font-size:32px;letter-spacing:8px;font-weight:700;color:#ffffff;margin:16px 0">${codigo}</p>
           <p>Ele vale por 15 minutos. Com o e-mail confirmado, você recupera a senha sozinho se um dia esquecer. 👊</p>`,
        ),
      });
      return json({ ok: true, email });
    }

    if (acao === "confirmar") {
      const codigo = String(body?.codigo ?? "").replace(/\D/g, "");
      if (codigo.length !== 6) return json({ error: "Código inválido." }, 400);

      const { data: row } = await admin.from("email_codigos").select("*").eq("user_id", user.id).maybeSingle();
      if (!row) return json({ error: "Peça um código novo." }, 400);
      if (new Date(row.expira_em).getTime() < Date.now()) {
        await admin.from("email_codigos").delete().eq("user_id", user.id);
        return json({ error: "Código expirado. Peça um novo." }, 400);
      }
      if (row.tentativas >= 5) {
        await admin.from("email_codigos").delete().eq("user_id", user.id);
        return json({ error: "Muitas tentativas. Peça um código novo." }, 400);
      }
      const ok = (await sha256Hex(`${user.id}:${codigo}`)) === row.codigo_hash;
      if (!ok) {
        await admin.from("email_codigos").update({ tentativas: row.tentativas + 1 }).eq("user_id", user.id);
        return json({ error: "Código incorreto." }, 400);
      }

      await admin.from("profiles")
        .update({ email: row.email, email_verificado_em: new Date().toISOString() })
        .eq("user_id", user.id);
      await admin.from("email_codigos").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    return json({ error: "acao inválida" }, 400);
  } catch (e) {
    console.error("email-confirmar:", e);
    return json({ error: "Não foi possível enviar agora. Tente de novo em instantes." }, 500);
  }
});
