// Orbis — pb-callback: fecha a conexão do PagBank e concede o selo.
// A tela /pb/retorno recebe code+state e manda pra cá com o login do vendedor.
//
// A troca do code por access_token no PagBank exige TRÊS credenciais juntas
// (descoberto na marra, testando contra a API deles):
//   1) Authorization: Bearer <token da conta parceira>  → PB_TOKEN
//      (sem ele: 401 41008 invalid_token)
//   2) X_CLIENT_ID / X_CLIENT_SECRET da aplicação Connect
//   3) corpo em JSON — apesar de ser OAuth2, form-urlencoded devolve 415.
// A tentativa alternativa em form-urlencoded só roda se o JSON for recusado por
// FORMATO (415), caso em que o code não chegou a ser consumido. O code do
// PagBank vale UMA vez e por 10 minutos — por isso nada de repetir à toa.
//
// As credenciais da aplicação vêm de public.pb_aplicacao (criada pela função
// pb-app, sem que o segredo passe por tela nem por chat).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const REDIRECT = "https://app.orbis.inf.br/pb/retorno";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const { code, state } = await req.json().catch(() => ({}));
    if (!code || !state) return json({ error: "faltou_code" });

    const URL_SUPA = Deno.env.get("SUPABASE_URL") ?? "";
    const supa = createClient(URL_SUPA, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await supa.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "sem_login" }, 401);

    const admin = createClient(URL_SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: app } = await admin.from("pb_aplicacao").select("client_id, client_secret, ambiente").eq("id", "orbis").maybeSingle();
    const clientId = ((app as any)?.client_id as string) || Deno.env.get("PB_CLIENT_ID");
    const clientSecret = ((app as any)?.client_secret as string) || Deno.env.get("PB_CLIENT_SECRET");
    const pbToken = Deno.env.get("PB_TOKEN") ?? "";
    if (!clientId || !clientSecret) return json({ error: "pb_nao_configurado" });
    const amb = ((app as any)?.ambiente as string) || Deno.env.get("PB_AMBIENTE") || "sandbox";
    const sandbox = amb !== "producao";

    const { data: st } = await admin.from("mp_oauth_states").select("user_id, criado_em, provedor").eq("state", state).maybeSingle();
    if (!st || (st as any).user_id !== uid || (st as any).provedor !== "pagbank") return json({ error: "state_invalido" });
    await admin.from("mp_oauth_states").delete().eq("state", state);
    if (Date.now() - new Date((st as any).criado_em).getTime() > 3600_000) return json({ error: "expirou" });

    const tokenUrl = sandbox ? "https://sandbox.api.pagseguro.com/oauth2/token" : "https://api.pagseguro.com/oauth2/token";

    const cabecalho = (tipo: string) => {
      const h: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": tipo,
        X_CLIENT_ID: clientId,
        X_CLIENT_SECRET: clientSecret,
      };
      if (pbToken) h.Authorization = `Bearer ${pbToken}`;
      return h;
    };

    // 1a tentativa: JSON (form-urlencoded devolveu 415 na tentativa anterior)
    let r = await fetch(tokenUrl, {
      method: "POST",
      headers: cabecalho("application/json"),
      body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: REDIRECT }),
      signal: AbortSignal.timeout(20000),
    });
    let texto = await r.text();
    let tk: any = {};
    try { tk = JSON.parse(texto); } catch { tk = {}; }

    // só repete se a recusa foi de FORMATO — aí o code segue válido
    if (r.status === 415) {
      console.error("pb-callback json recusado 415, tentando form");
      r = await fetch(tokenUrl, {
        method: "POST",
        headers: cabecalho("application/x-www-form-urlencoded"),
        body: new URLSearchParams({ grant_type: "authorization_code", code: String(code), redirect_uri: REDIRECT }).toString(),
        signal: AbortSignal.timeout(20000),
      });
      texto = await r.text();
      try { tk = JSON.parse(texto); } catch { tk = {}; }
    }

    const token = tk?.access_token ?? tk?.accessToken;
    if (!r.ok || !token) {
      console.error("pb-callback token erro", r.status, "pbToken?", !!pbToken, "corpo:", texto.slice(0, 500));
      return json({ error: "token", pb_status: r.status, dica: texto.slice(0, 200) });
    }

    await admin.from("mp_conexoes").upsert({
      user_id: uid,
      provedor: "pagbank",
      mp_user_id: String(tk?.account_id ?? tk?.accountId ?? tk?.user_id ?? ""),
      access_token: token,
      refresh_token: tk?.refresh_token ?? tk?.refreshToken ?? null,
      expira_em: new Date(Date.now() + (Number(tk?.expires_in ?? tk?.expiresIn) || 31536000) * 1000).toISOString(),
      ativo: true,
      apelido: "PagBank",
      conectado_em: new Date().toISOString(),
      ultimo_erro: null,
    });

    await admin.rpc("conexao_conceder_selo", { p_user: uid });

    return json({ ok: true, apelido: "PagBank", vendas: 0, verificado: true, ambiente: sandbox ? "sandbox" : "producao" });
  } catch (e) {
    console.error("pb-callback", e);
    return json({ error: "erro_interno" }, 500);
  }
});
