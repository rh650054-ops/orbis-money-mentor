// Vant — pluggy-item: o widget terminou e devolveu um itemId. Aqui a gente
// CONFERE esse item na Pluggy (nunca confia no que veio da tela), guarda a
// conexao, CONCEDE O SELO DE VERIFICADO e puxa a primeira leva de entradas.
//
// Por que o selo sai aqui e nao na carteira: o selo da Vant significa
// "a conta bancaria desse vendedor foi conferida". Carteira (Mercado Pago,
// PagBank) e gratis e serve pra conciliar e cobrar — mas quem verifica e o banco.
//
// 10/09/2026: agora importa as entradas dos ultimos 7 dias NA HORA. Antes
// esperava o proximo webhook da Pluggy, que pode nunca vir (o item ja nasce
// UPDATED e a Pluggy nao manda item/updated de novo). O vendedor ligava o
// banco e via a tela vazia — parecia quebrado.
//
// Entrada: { item_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { importarPiloto } from "../_shared/pluggy-piloto.ts";
import { importarEntradas } from "../_shared/pluggy-entradas.ts";

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

// 11/10/2026: a leitura das entradas é a mesma dos outros (../_shared/pluggy-entradas.ts):
// guarda Pix, hora exata, pagador e dono da conta.

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

    const { data: ehPro } = await supa.rpc("orbis_pro_ativo", { p_user: uid });
    if (ehPro !== true) return json({ error: "precisa_pro" });

    // deno-lint-ignore no-explicit-any
    const body = await req.json().catch(() => ({} as any));
    const itemId = String(body?.item_id ?? "").trim();
    if (!itemId) return json({ error: "faltou_item" }, 400);

    const apiKey = await pluggyKey();
    if (!apiKey) return json({ error: "pluggy_nao_configurado" });

    // ---- confere o item NA PLUGGY (o front pode mentir; a Pluggy nao)
    const itRes = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(itemId)}`, {
      headers: { "X-API-KEY": apiKey },
      signal: AbortSignal.timeout(20000),
    });
    if (!itRes.ok) {
      console.error("pluggy item nao encontrado", itRes.status);
      return json({ error: "item_invalido" });
    }
    const item = await itRes.json();

    // o item TEM que ser deste vendedor — o clientUserId foi carimbado no connect_token
    const dono = String(item?.clientUserId ?? "");
    if (dono && dono !== uid) {
      console.error("pluggy item de outro usuario", itemId);
      return json({ error: "item_de_outro" }, 403);
    }

    const status = String(item?.status ?? "");
    const banco = String(item?.connector?.name ?? "Banco");
    const logo = item?.connector?.imageUrl ?? null;

    const admin = createClient(URL_SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: con } = await admin.from("bank_connections").upsert({
      user_id: uid,
      item_id: itemId,
      institution_name: banco,
      institution_logo: logo,
      status: status || "UPDATED",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "item_id" }).select("id").maybeSingle();

    // ---- SELO: conectou banco, virou verificado
    let selo = false;
    if (status === "UPDATED" || status === "UPDATING" || status === "LOGIN_IN_PROGRESS") {
      const { error: eSelo } = await admin.rpc("banco_conceder_selo", { p_user: uid });
      if (eSelo) console.error("selo nao concedido", eSelo.message);
      else selo = true;
    }

    // ---- primeira leva de entradas, ja. Falha aqui nao derruba a conexao.
    let entradas = 0;
    // deno-lint-ignore no-explicit-any
    const conId = String((con as any)?.id ?? "");
    if (conId && status === "UPDATED") {
      try {
        const r = await importarEntradas(admin, apiKey, itemId, uid, conId, 7);
        entradas = r.gravadas;
        console.log(`pluggy-item: ${r.contas} contas, ${r.gravadas} entradas para ${uid}`);
      } catch (e) {
        console.error("pluggy-item: importar falhou", (e as Error)?.message);
      }
      // 04/10 (Mohamed): o saldo e os gastos também entram NA HORA (Piloto Automático).
      // Antes só vinham na rodada do cron (8h → 0h02): banco ligado de madrugada ficava
      // vazio nas Finanças e no Raio-X até de manhã.
      try {
        const p = await importarPiloto(admin, apiKey, itemId, uid, conId, banco ?? null);
        console.log(`pluggy-item: piloto ${p.saldos} saldos, ${p.gravadas} lançamentos`);
        if (p.gravadas > 0) await admin.rpc("extrato_analisar_padroes", { p_uid: uid });
      } catch (e) {
        console.error("pluggy-item: piloto falhou", (e as Error)?.message);
      }
    }

    return json({ ok: true, banco, status, verificado: selo, entradas });
  } catch (e) {
    console.error("pluggy-item", e);
    return json({ error: "erro_interno" }, 500);
  }
});
