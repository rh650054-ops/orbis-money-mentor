// Vant — pluggy-sync: "puxa agora" o extrato do banco do vendedor logado.
// Chamado pelo fechamento do dia: antes de mostrar "caiu X no Pix", a Vant
// pede pra Pluggy atualizar o item (PATCH) e importa o que ja existe la.
// A atualizacao de verdade chega depois pelo pluggy-webhook (item/updated);
// aqui e o melhor que da pra ter NA HORA, sem o vendedor esperar.
//
// Freio: nao pede atualizacao na Pluggy mais que 1x a cada 10 min por conexao.
// 02/10/2026: o importador mora em _shared/pluggy-entradas.ts (o mesmo do
// pluggy-hora) e agora grava is_pix, transacted_at e own_transfer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { pluggyKey, importarEntradas, pedirAtualizacao } from "../_shared/pluggy-entradas.ts";

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

    const admin = createClient(URL_SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: cons } = await admin.from("bank_connections")
      .select("id, item_id, status, last_synced_at").eq("user_id", uid).neq("status", "deleted");
    // deno-lint-ignore no-explicit-any
    const lista: any[] = cons ?? [];
    if (lista.length === 0) return json({ ok: true, conexoes: 0, entradas: 0 });

    const apiKey = await pluggyKey();
    if (!apiKey) return json({ error: "pluggy_nao_configurado" });

    let entradas = 0;
    let pediu = 0;
    for (const c of lista) {
      const ha = c.last_synced_at ? Date.now() - new Date(c.last_synced_at).getTime() : Infinity;
      if (ha > 10 * 60_000 && await pedirAtualizacao(apiKey, c.item_id)) pediu++;
      try {
        const r = await importarEntradas(admin, apiKey, c.item_id, uid, c.id, 2);
        entradas += r.gravadas;
      } catch (e) { console.error("pluggy-sync: importar", (e as Error)?.message); }
      await admin.from("bank_connections").update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", c.id);
    }
    return json({ ok: true, conexoes: lista.length, entradas, pediu_atualizacao: pediu });
  } catch (e) {
    console.error("pluggy-sync", e);
    return json({ error: "erro_interno" }, 500);
  }
});
