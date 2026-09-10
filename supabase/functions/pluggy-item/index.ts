// Orbis — pluggy-item: o widget terminou e devolveu um itemId. Aqui a gente
// CONFERE esse item na Pluggy (nunca confia no que veio da tela), guarda a
// conexao, CONCEDE O SELO DE VERIFICADO e puxa a primeira leva de entradas.
//
// Por que o selo sai aqui e nao na carteira: o selo do Orbis significa
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
 *  Pluggy (10/09/2026): o GET /transactions antigo responde 410 Gone. O vivo e o
 *  /v2/transactions, paginado por cursor (`next`). Contas de CARTAO ficam de fora:
 *  "CREDIT" la e pagamento de fatura, nao venda. Venda de rua cai na conta corrente. */
// deno-lint-ignore no-explicit-any
async function importarEntradas(admin: any, apiKey: string, itemId: string, userId: string, conexaoId: string, dias = 7) {
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
      // so ENTRADA de dinheiro (venda / Pix recebido). Saida nao interessa aqui.
      // filtro de data tambem aqui: se a Pluggy ignorar o dateFrom, nao importamos meses de historico
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
    }

    return json({ ok: true, banco, status, verificado: selo, entradas });
  } catch (e) {
    console.error("pluggy-item", e);
    return json({ error: "erro_interno" }, 500);
  }
});
