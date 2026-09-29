// recuperar-senha — "esqueci minha senha" self-service, sem login (verify_jwt = false).
// Entrada: { cpf: string }. Saida: SEMPRE { ok: true } (nao revela se o CPF existe,
// se tem e-mail, nem se o e-mail esta confirmado — quem tem, recebe o link).
//
// Seguranca:
//  - so manda para e-mail CONFIRMADO (profiles.email_verificado_em NOT NULL);
//  - o link de recovery e gerado pelo servidor (auth.admin.generateLink) para o
//    e-mail INTERNO da conta e enviado ao e-mail pessoal; expira conforme o Auth (1h);
//  - freio: 3 pedidos por CPF/h e 10 por IP/h (cadastro_pode_tentar, service_role only);
//  - resposta identica em todos os caminhos (evita enumeracao).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { enviarEmail, layoutEmail, sha256Hex } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ok = () =>
  new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

const APP_URL = Deno.env.get("APP_URL") ?? "https://app.orbis.inf.br";

function cpfValido(c: string): boolean {
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return ok();

  try {
    const body = await req.json().catch(() => ({}));
    const cpf = String(body?.cpf ?? "").replace(/\D/g, "");
    if (!cpfValido(cpf)) return ok();

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Freio por IP e por CPF (hash — o CPF nao vai em claro pra tabela de freio)
    const ip = (req.headers.get("x-forwarded-for") ?? "?").split(",")[0]!.trim();
    const [{ data: podeIp }, { data: podeCpf }] = await Promise.all([
      admin.rpc("cadastro_pode_tentar", { p_chave: `rec:ip:${ip}`, p_teto: 10, p_janela_min: 60 }),
      admin.rpc("cadastro_pode_tentar", { p_chave: `rec:cpf:${(await sha256Hex(cpf)).slice(0, 32)}`, p_teto: 3, p_janela_min: 60 }),
    ]);
    if (podeIp === false || podeCpf === false) return ok();

    const { data: perfil } = await admin
      .from("profiles")
      .select("email, email_verificado_em, nickname")
      .eq("cpf", cpf)
      .not("email_verificado_em", "is", null)
      .maybeSingle();
    if (!perfil?.email) return ok();

    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: `${cpf}@orbis.internal`,
      options: { redirectTo: `${APP_URL}/reset-password` },
    });
    if (error || !link?.properties?.action_link) {
      console.error("recuperar-senha generateLink:", error);
      return ok();
    }

    await enviarEmail({
      to: perfil.email,
      subject: "Recuperar sua senha da Vant",
      html: layoutEmail(
        `Bora voltar, ${perfil.nickname ?? "vendedor"}?`,
        `<p>Recebemos um pedido pra trocar a senha da sua conta na Vant.</p>
         <p style="margin:20px 0"><a href="${link.properties.action_link}" style="display:inline-block;background:#f5c518;color:#111;font-weight:700;padding:14px 22px;border-radius:10px;text-decoration:none">Criar nova senha</a></p>
         <p>O link vale por 1 hora e só funciona uma vez.</p>`,
      ),
    });
    return ok();
  } catch (e) {
    console.error("recuperar-senha:", e);
    return ok();
  }
});
