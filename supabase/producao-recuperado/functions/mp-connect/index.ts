// Orbis — mp-connect: devolve a URL onde o vendedor autoriza o Orbis a ler as
// vendas da conta DELE no Mercado Pago. Guarda um "state" (senha de ida e volta)
// pra ninguém conseguir plugar a conta de outra pessoa no seu login.
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
    const clientId = Deno.env.get("MP_CLIENT_ID");
    if (!clientId) return json({ error: "mp_nao_configurado", dica: "O admin precisa colar MP_CLIENT_ID e MP_CLIENT_SECRET nos secrets do Supabase." });

    const supa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: u } = await supa.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "sem_login" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const state = crypto.randomUUID();
    await admin.from("mp_oauth_states").insert({ state, user_id: uid });
    // limpa states velhos (mais de 1h) pra tabela não crescer à toa
    await admin.from("mp_oauth_states").delete().lt("criado_em", new Date(Date.now() - 3600_000).toISOString());

    const url = `https://auth.mercadopago.com/authorization?client_id=${encodeURIComponent(clientId)}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT)}`;
    return json({ ok: true, url });
  } catch (e) {
    console.error("mp-connect", e);
    return json({ error: "erro_interno" }, 500);
  }
});
