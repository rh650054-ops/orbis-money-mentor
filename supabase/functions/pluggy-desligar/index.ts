// Vant — pluggy-desligar: o vendedor desconecta um banco pela tela Vant Pro (03/10/2026).
//
// 1) Confere que a conexão é DELE (pelo login, nunca pelo corpo do pedido).
// 2) Apaga o item na Pluggy: a Vant para de ter acesso ao banco na hora.
//    Se a Pluggy já não conhece o item (404), segue: o objetivo já está cumprido.
// 3) Marca a conexão como 'deleted'. Nada é apagado do Vant: o Pix já lido fica
//    no histórico, mas banco desconectado não conta mais (banco_pix_por_dia),
//    sai da home de Finanças e do selo (usuario_verificado).
// Não mexe em pluggy-item nem pluggy-webhook.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pluggyKey } from "../_shared/pluggy-entradas.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
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

    const corpo = await req.json().catch(() => ({}));
    const conexaoId = String(corpo?.conexao_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(conexaoId)) return json({ error: "conexao_invalida" }, 400);

    const admin = createClient(URL_SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: c } = await admin.from("bank_connections")
      .select("id, item_id, user_id, status, institution_name")
      .eq("id", conexaoId).eq("user_id", uid).maybeSingle();
    if (!c) return json({ error: "nao_encontrada" }, 404);
    if (c.status === "deleted") return json({ ok: true, banco: c.institution_name, ja_estava: true });

    let pluggy = "sem_item";
    if (c.item_id) {
      const apiKey = await pluggyKey();
      if (!apiKey) return json({ error: "pluggy_nao_configurado" }, 503);
      const r = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(c.item_id)}`, {
        method: "DELETE", headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(20000),
      });
      if (!r.ok && r.status !== 404) {
        console.error("pluggy-desligar: pluggy", r.status, (await r.text()).slice(0, 160));
        return json({ error: "pluggy_recusou" }, 502);
      }
      pluggy = r.ok ? "apagado" : "ja_nao_existia";
    }

    const agora = new Date().toISOString();
    const { error } = await admin.from("bank_connections")
      .update({ status: "deleted", updated_at: agora }).eq("id", c.id).eq("user_id", uid);
    if (error) {
      console.error("pluggy-desligar: update", error.message);
      return json({ error: "erro_interno" }, 500);
    }
    console.log("pluggy-desligar", { conexao: c.id, pluggy });
    return json({ ok: true, banco: c.institution_name, pluggy });
  } catch (e) {
    console.error("pluggy-desligar", e);
    return json({ error: "erro_interno" }, 500);
  }
});
