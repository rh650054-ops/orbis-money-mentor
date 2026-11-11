// Orbis — pb-connect: URL onde o vendedor autoriza o Orbis a ler as vendas da
// conta dele no PagBank (PagBank Connect / OAuth2). Mesmo desenho do Mercado
// Pago: um "state" de ida e volta que vale uma vez e é amarrado ao usuário.
// PB_AMBIENTE = 'sandbox' (padrão) ou 'producao'.
//
// O client_id vem de public.pb_aplicacao (criado pela função pb-app, sem que o
// segredo passe por tela nem por chat). Se ainda não existir, aceita PB_CLIENT_ID
// dos secrets — os dois caminhos funcionam.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const REDIRECT = "https://app.orbis.inf.br/pb/retorno";
// leitura das vendas + dados da conta, e criar cobrança (o cobrador de calote).
// Nada de estorno: o Orbis nunca mexe no dinheiro que já caiu.
const SCOPE = "payments.read payments.create accounts.read";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const URL_SUPA = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(URL_SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: app } = await admin.from("pb_aplicacao").select("client_id, ambiente").eq("id", "orbis").maybeSingle();
    const clientId = ((app as any)?.client_id as string) || Deno.env.get("PB_CLIENT_ID");
    if (!clientId) {
      return json({ error: "pb_nao_configurado", dica: "Falta criar a aplicação Connect (função pb-app) ou colar PB_CLIENT_ID nos secrets." });
    }
    const amb = ((app as any)?.ambiente as string) || Deno.env.get("PB_AMBIENTE") || "sandbox";
    const sandbox = amb !== "producao";

    const supa = createClient(URL_SUPA, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await supa.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "sem_login" }, 401);

    const state = crypto.randomUUID().replace(/-/g, ""); // PagBank aceita alfanumérico
    await admin.from("mp_oauth_states").insert({ state, user_id: uid, provedor: "pagbank" });
    await admin.from("mp_oauth_states").delete().lt("criado_em", new Date(Date.now() - 3600_000).toISOString());

    const base = sandbox ? "https://connect.sandbox.pagbank.com.br/oauth2/authorize" : "https://connect.pagbank.com.br/oauth2/authorize";
    const url = `${base}?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=${encodeURIComponent(SCOPE)}&state=${state}`;
    return json({ ok: true, url, ambiente: sandbox ? "sandbox" : "producao" });
  } catch (e) {
    console.error("pb-connect", e);
    return json({ error: "erro_interno" }, 500);
  }
});
