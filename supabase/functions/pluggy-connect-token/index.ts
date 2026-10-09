// Vant — pluggy-connect-token: token curto pro widget da Pluggy abrir.
// TRAVA DO PRO: conectar banco pelo Open Finance custa (+R$ 10/mes), porque a
// Pluggy cobra da Vant por isso. Sem Pro, nem gera o token.
// O client_secret da Pluggy nunca sai do servidor.
// 03/10/2026: o Pro inclui 1 banco; banco a mais = +R$ 10/mês (open_finance_limite).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const URL_SUPA = Deno.env.get("SUPABASE_URL") ?? "";
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth) return json({ error: "sem_login" }, 401);

    const supa = createClient(URL_SUPA, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supa.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "sem_login" }, 401);

    // ---- trava do Pro
    const { data: ehPro } = await supa.rpc("orbis_pro_ativo", { p_user: uid });
    if (ehPro !== true) return json({ error: "precisa_pro" });

    // ---- autorizar de novo um banco que já é dele (09/10): o consentimento expirou
    // (WAITING_USER_INPUT / LOGIN_ERROR). Abre o widget no MESMO item, sem gastar vaga.
    let itemId: string | null = null;
    try { const b = await req.clone().json(); itemId = typeof b?.itemId === "string" ? b.itemId : null; } catch { /* sem corpo */ }
    if (itemId) {
      const { data: meu } = await supa.from("bank_connections").select("id").eq("item_id", itemId).eq("user_id", uid).maybeSingle();
      if (!meu) itemId = null;
    }

    // ---- trava de quantos bancos (Rick, 03/10): o Pro liga 1 banco; cada um a mais
    // é +R$ 10/mês (bancos_extra). Rick e Mohamed são isentos. Sem vaga, nem abre o banco.
    const { data: lim } = await supa.rpc("open_finance_limite", {});
    if (!itemId && lim && lim.pode_conectar === false) {
      return json({ error: "precisa_banco_extra", usados: lim.usados, limite: lim.limite });
    }

    const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
    const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
    if (!clientId || !clientSecret) return json({ error: "pluggy_nao_configurado" });

    // 1) autentica no Pluggy pra pegar a apiKey (curta)
    const authRes = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
      signal: AbortSignal.timeout(20000),
    });
    if (!authRes.ok) {
      console.error("pluggy auth falhou", authRes.status, (await authRes.text()).slice(0, 200));
      return json({ error: "pluggy_auth" });
    }
    const { apiKey } = await authRes.json();

    // 2) token do widget — amarrado a ESTE vendedor (clientUserId)
    const ctRes = await fetch("https://api.pluggy.ai/connect_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify(itemId ? { itemId, options: { clientUserId: uid } } : { options: { clientUserId: uid } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!ctRes.ok) {
      console.error("pluggy connect_token falhou", ctRes.status, (await ctRes.text()).slice(0, 200));
      return json({ error: "pluggy_token" });
    }
    const { accessToken } = await ctRes.json();

    return json({ ok: true, accessToken });
  } catch (e) {
    console.error("pluggy-connect-token", e);
    return json({ error: "erro_interno" }, 500);
  }
});
