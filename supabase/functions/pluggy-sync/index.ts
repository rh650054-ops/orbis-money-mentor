// Orbis — pluggy-sync: "puxa agora" o extrato do banco do vendedor logado.
// Chamado pelo fechamento do dia: antes de mostrar "caiu X no Pix", o Orbis
// pede pra Pluggy atualizar o item (PATCH) e importa o que ja existe la.
// A atualizacao de verdade chega depois pelo pluggy-webhook (item/updated);
// aqui e o melhor que da pra ter NA HORA, sem o vendedor esperar.
//
// Freio: nao pede atualizacao na Pluggy mais que 1x a cada 10 min por conexao.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function pluggyKey() {
  const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const r = await fetch("https://api.pluggy.ai/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return null;
  const { apiKey } = await r.json();
  return apiKey as string;
}

/** Puxa so as ENTRADAS (CREDIT) dos ultimos `dias` dias e guarda como venda a conferir.
 *  Mesma rotina do pluggy-item / pluggy-webhook: /v2/transactions por cursor, so conta BANK. */
// deno-lint-ignore no-explicit-any
async function importarEntradas(admin: any, apiKey: string, itemId: string, userId: string, conexaoId: string, dias = 3) {
  const contasRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(itemId)}`, {
    headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(25000),
  });
  // deno-lint-ignore no-explicit-any
  const contas: any[] = ((await contasRes.json().catch(() => ({})))?.results ?? [])
    .filter((c: { type?: string }) => String(c?.type ?? "").toUpperCase() === "BANK");

  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const dataDe = desde.toISOString().split("T")[0];

  let gravadas = 0;
  for (const conta of contas) {
    let cursor: string | null = null;
    for (let pagina = 0; pagina < 5; pagina++) {
      const u = `https://api.pluggy.ai/v2/transactions?accountId=${encodeURIComponent(conta.id)}&dateFrom=${dataDe}` +
        (cursor ? `&after=${encodeURIComponent(cursor)}` : "");
      const txRes = await fetch(u, { headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(25000) });
      if (!txRes.ok) { console.error("pluggy transactions", txRes.status, conta.id); break; }
      // deno-lint-ignore no-explicit-any
      const corpo: any = await txRes.json().catch(() => ({}));
      // deno-lint-ignore no-explicit-any
      const txs: any[] = corpo?.results ?? [];
      const entradas = txs.filter((t) => t?.type === "CREDIT" && Number(t?.amount) > 0 &&
        String(t?.date ?? "").slice(0, 10) >= dataDe);
      for (const t of entradas) {
        const dia = t?.date ? String(t.date).split("T")[0] : dataDe;
        const { error } = await admin.from("auto_detected_sales").upsert({
          user_id: userId,
          bank_connection_id: conexaoId,
          transaction_id: String(t.id),
          amount: Number(t.amount),
          description: t?.description ?? null,
          transaction_date: dia,
          status: "pending",
        }, { onConflict: "transaction_id", ignoreDuplicates: true });
        if (!error) gravadas++;
      }
      cursor = corpo?.next ? String(corpo.next) : null;
      if (!cursor) break;
    }
  }
  return { contas: contas.length, gravadas };
}

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
      if (ha > 10 * 60_000) {
        // pede pra Pluggy buscar dados novos no banco (a resposta vem pelo webhook)
        try {
          const p = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(c.item_id)}`, {
            method: "PATCH", headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
            body: "{}", signal: AbortSignal.timeout(15000),
          });
          if (p.ok) pediu++; else console.log("pluggy-sync: patch", p.status, (await p.text()).slice(0, 120));
        } catch (e) { console.log("pluggy-sync: patch falhou", (e as Error)?.message); }
      }
      try {
        const r = await importarEntradas(admin, apiKey, c.item_id, uid, c.id, 3);
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
