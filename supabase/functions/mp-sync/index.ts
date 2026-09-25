// Vant — mp-sync: puxa as vendas das contas conectadas no MERCADO PAGO.
// Três modos de entrada (verify_jwt=false, a conferência é feita aqui dentro):
//   1) login do vendedor (Authorization: Bearer <jwt do app>)  → sincroniza SÓ ele
//   2) service_role + {user_id, dias}                          → uso interno (mp-callback)
//   3) {job:true} + cabeçalho x-orbis-cron                     → modo cron: varre os atrasados
// Em nenhum modo dá pra ler dado de outra pessoa: a resposta é só contagem.
// Também renova o access_token quando falta menos de 15 dias pra vencer.
//
// SEGURANÇA (09/09/2026): o modo 3 não pedia NADA. Um `curl -d '{"job":true}'`
// de qualquer lugar do mundo fazia o servidor abrir os tokens de até 20
// vendedores, bater na API do Mercado Pago em nome deles e girar refresh_token.
// Agora exige o cabeçalho x-orbis-cron, cujo valor mora em painel_tokens
// (tabela sem RLS pra cliente nenhum). O cron job manda esse cabeçalho.
//
// IMPORTANTE (09/09): a tabela mp_conexoes virou MULTI-CARTEIRA — a chave é
// (user_id, provedor). Todo select e todo update aqui filtram por
// provedor='mercadopago'. Sem isso, o cron pegava a conexão do PagBank, batia
// na API do Mercado Pago com o token errado (401) e ainda carimbava o erro nas
// DUAS linhas do vendedor — fazendo o app dizer que a conexão boa tinha quebrado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const URL_SUPA = Deno.env.get("SUPABASE_URL") ?? "";
const PROV = "mercadopago";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-orbis-cron",
};

const brDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** compara sem vazar por tempo */
function mesmo(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/** a chave do cron mora no banco, não no código. Cache curto pra não pesar. */
let cacheCron: { token: string; ate: number } | null = null;
async function chaveDoCron(admin: any): Promise<string> {
  if (cacheCron && cacheCron.ate > Date.now()) return cacheCron.token;
  const { data } = await admin.from("painel_tokens").select("token").eq("nome", "cron").maybeSingle();
  const token = String((data as any)?.token ?? "");
  if (token) cacheCron = { token, ate: Date.now() + 300_000 };
  return token;
}

/** update que NUNCA vaza pra linha de outra carteira do mesmo vendedor */
const marcar = (admin: any, userId: string, campos: Record<string, unknown>) =>
  admin.from("mp_conexoes").update(campos).eq("user_id", userId).eq("provedor", PROV);

async function renovar(admin: any, con: any) {
  const clientId = Deno.env.get("MP_CLIENT_ID");
  const clientSecret = Deno.env.get("MP_CLIENT_SECRET");
  if (!clientId || !clientSecret || !con.refresh_token) return con.access_token;
  const r = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: con.refresh_token }),
    signal: AbortSignal.timeout(20000),
  });
  const tk = await r.json().catch(() => ({}));
  if (!r.ok || !tk?.access_token) {
    await marcar(admin, con.user_id, { ultimo_erro: "renovacao_falhou" });
    return con.access_token;
  }
  await marcar(admin, con.user_id, {
    access_token: tk.access_token,
    refresh_token: tk.refresh_token ?? con.refresh_token,
    expira_em: new Date(Date.now() + (Number(tk.expires_in) || 15552000) * 1000).toISOString(),
    ultimo_erro: null,
  });
  return tk.access_token as string;
}

async function sincronizar(admin: any, con: any, dias: number) {
  // trava de seguranca: essa funcao so fala com o Mercado Pago
  if (con?.provedor && con.provedor !== PROV) return 0;

  let token = con.access_token as string;
  if (new Date(con.expira_em).getTime() - Date.now() < 15 * 86400_000) token = await renovar(admin, con);

  const desde = new Date(Date.now() - Math.max(1, dias) * 86400_000).toISOString();
  const url = `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&range=date_created&begin_date=${encodeURIComponent(desde)}&end_date=NOW&limit=100`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("mp-sync busca erro", con.user_id, r.status, t.slice(0, 200));
    await marcar(admin, con.user_id, { ultimo_erro: `busca_${r.status}`, ultima_sync_em: new Date().toISOString() });
    return 0;
  }
  const js = await r.json();
  const results: any[] = js?.results ?? [];
  const linhas = results
    .filter((p) => !p?.collector_id || String(p.collector_id) === String(con.mp_user_id)) // só o que ELE recebeu
    .map((p) => {
      const pago = p?.date_approved ?? p?.date_created;
      const poi = String(p?.point_of_interaction?.type ?? "").toLowerCase();
      return {
        payment_id: String(p.id),
        user_id: con.user_id,
        valor: Number(p?.transaction_amount) || 0,
        liquido: Number(p?.transaction_details?.net_received_amount) || null,
        metodo: String(p?.payment_method_id ?? p?.payment_type_id ?? ""),
        origem: poi.includes("point") ? "point" : poi.includes("qr") ? "qr" : poi.includes("link") ? "link" : "outro",
        status: String(p?.status ?? ""),
        descricao: String(p?.description ?? "").slice(0, 120),
        pago_em: pago,
        data: brDate(pago),
      };
    })
    .filter((l) => l.valor > 0 && l.pago_em);

  if (linhas.length > 0) {
    // ignoreDuplicates: nunca reescreve uma venda que o vendedor já lançou
    await admin.from("mp_vendas").upsert(linhas, { onConflict: "payment_id", ignoreDuplicates: true });
  }
  await marcar(admin, con.user_id, { ultima_sync_em: new Date().toISOString(), ultimo_erro: null });
  return linhas.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  const admin = createClient(URL_SUPA, SERVICE);
  const auth = req.headers.get("Authorization") ?? "";
  const body = await req.json().catch(() => ({} as any));

  try {
    // 1) interno (mp-callback) — service_role + user_id
    if (SERVICE && auth.includes(SERVICE) && body?.user_id) {
      const { data: con } = await admin.from("mp_conexoes").select("*")
        .eq("user_id", body.user_id).eq("provedor", PROV).eq("ativo", true).maybeSingle();
      if (!con) return json({ error: "sem_conexao" });
      return json({ ok: true, vendas: await sincronizar(admin, con, Number(body.dias) || 1) });
    }
    // 2) vendedor logado — sincroniza só a conta dele
    if (auth && !auth.includes(SERVICE)) {
      const supa = createClient(URL_SUPA, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: auth } } });
      const { data: u } = await supa.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return json({ error: "sem_login" }, 401);
      const { data: con } = await admin.from("mp_conexoes").select("*")
        .eq("user_id", uid).eq("provedor", PROV).eq("ativo", true).maybeSingle();
      if (!con) return json({ error: "sem_conexao" });
      return json({ ok: true, vendas: await sincronizar(admin, con, Number(body?.dias) || 1) });
    }
    // 3) cron — até 20 contas por rodada, começando pelas mais atrasadas.
    //    SÓ entra aqui com a chave do cron; sem ela é gente de fora.
    if (body?.job === true) {
      const esperado = await chaveDoCron(admin);
      const veio = (req.headers.get("x-orbis-cron") ?? "").trim();
      if (!esperado || !mesmo(veio, esperado)) return json({ error: "nao_autorizado" }, 401);
      const { data: cons } = await admin.from("mp_conexoes").select("*")
        .eq("provedor", PROV).eq("ativo", true)
        .order("ultima_sync_em", { ascending: true, nullsFirst: true }).limit(20);
      let total = 0;
      for (const con of (cons as any[]) || []) total += await sincronizar(admin, con, 1);
      return json({ ok: true, contas: (cons as any[])?.length ?? 0, vendas: total });
    }
    return json({ error: "nao_autorizado" }, 401);
  } catch (e) {
    console.error("mp-sync", e);
    return json({ error: "erro_interno" }, 500);
  }
});
