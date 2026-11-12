// Orbis — mp-callback: fecha a conexão do Mercado Pago.
// O MP devolve o vendedor em https://app.orbis.inf.br/mp/retorno?code=...&state=...
// A tela lê code+state e manda pra cá (com o login dele). Aqui trocamos o code
// por access_token (180 dias) + refresh_token, guardamos na tabela fechada e
// CONCEDEMOS O SELO DE VERIFICADO.
// Duas travas: o state tem que existir E ser do usuário logado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const REDIRECT = "https://app.orbis.inf.br/mp/retorno";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const { code, state } = await req.json().catch(() => ({}));
    if (!code || !state) return json({ error: "faltou_code" });

    const supa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await supa.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "sem_login" }, 401);

    const clientId = Deno.env.get("MP_CLIENT_ID");
    const clientSecret = Deno.env.get("MP_CLIENT_SECRET");
    if (!clientId || !clientSecret) return json({ error: "mp_nao_configurado", dica: "Faltam MP_CLIENT_ID / MP_CLIENT_SECRET nos secrets." });

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: st } = await admin.from("mp_oauth_states").select("user_id, criado_em").eq("state", state).maybeSingle();
    if (!st || (st as any).user_id !== uid) return json({ error: "state_invalido" });
    await admin.from("mp_oauth_states").delete().eq("state", state);
    if (Date.now() - new Date((st as any).criado_em).getTime() > 3600_000) return json({ error: "expirou" });

    const r = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: REDIRECT }),
      signal: AbortSignal.timeout(20000),
    });
    const tk = await r.json().catch(() => ({}));
    if (!r.ok || !tk?.access_token) {
      console.error("mp-callback token erro", r.status, JSON.stringify(tk).slice(0, 300));
      return json({ error: "token", mp_status: r.status, dica: String(tk?.message ?? "").slice(0, 140) });
    }

    let apelido: string | null = null;
    try {
      const me = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${tk.access_token}` }, signal: AbortSignal.timeout(10000) });
      if (me.ok) { const mj = await me.json(); apelido = mj?.nickname ?? mj?.email ?? null; }
    } catch { /* segue sem apelido */ }

    await admin.from("mp_conexoes").upsert({
      user_id: uid,
      provedor: "mercadopago",
      mp_user_id: String(tk.user_id ?? ""),
      access_token: tk.access_token,
      refresh_token: tk.refresh_token ?? null,
      expira_em: new Date(Date.now() + (Number(tk.expires_in) || 15552000) * 1000).toISOString(),
      ativo: true,
      apelido,
      conectado_em: new Date().toISOString(),
      ultimo_erro: null,
    });

    // SELO: conta conectada vira conta verificada
    await admin.rpc("conexao_conceder_selo", { p_user: uid });

    let vendas = 0;
    try {
      const s = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ user_id: uid, dias: 2 }),
        signal: AbortSignal.timeout(25000),
      });
      const sj = await s.json().catch(() => ({}));
      vendas = Number(sj?.vendas) || 0;
    } catch { /* o cron pega depois */ }

    return json({ ok: true, apelido, vendas, verificado: true });
  } catch (e) {
    console.error("mp-callback", e);
    return json({ error: "erro_interno" }, 500);
  }
});
