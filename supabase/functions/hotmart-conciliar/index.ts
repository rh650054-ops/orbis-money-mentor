// Vant — hotmart-conciliar (Rick, 26/11/2026). "Já paguei, conferir" on the renewal screens.
// Asks Hotmart (read only) the REAL status of the person's own subscriptions and, when Hotmart
// says it is paid, releases access here with the same function the webhook uses. Never charges,
// cancels or creates a subscription. Door: the person's session (Authorization) or the 30-minute
// /assinar token ({ t }). At most one check per person per minute.
// Batch (recovery of people already blocked): header x-orbis-cron (painel_tokens nome='cron') +
// { todos: true, teste?: true } → every blocked account with a live Hotmart subscription
// (max 150 per run). teste = only reports what it would release.
// Credentials only from the Supabase panel (HOTMART_*), never logged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tokenHotmart } from "../hotmart-webhook/cancelar-padrao.ts";
import { decidir, type NossaAssinatura } from "./regras.ts";

const API = "https://developers.hotmart.com/payments/api/v1/subscriptions";
const VIVAS = ["ACTIVE", "PAST_DUE", "DELAYED", "OVERDUE", "STARTED"];
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const corpo = await req.json().catch(() => ({})) as { t?: string };
    // batch door (cron token): recover every blocked account at once
    const cron = req.headers.get("x-orbis-cron") ?? "";
    if (cron && (corpo as { todos?: boolean }).todos) {
      const { data: tk } = await admin.from("painel_tokens").select("token").eq("nome", "cron").maybeSingle();
      if (!tk?.token || cron !== String(tk.token)) return json({ error: "nao_autorizado" }, 401);
      const teste = !!(corpo as { teste?: boolean }).teste;
      const { data: vivas } = await admin.from("orbis_hotmart_assinatura").select("user_id").in("status_hotmart", VIVAS).not("user_id", "is", null).limit(1000);
      const ids = [...new Set((vivas ?? []).map((v) => String(v.user_id)))];
      const { data: bloqueados } = await admin.from("profiles").select("user_id").in("user_id", ids).neq("plan_status", "active").not("billing_exempt", "is", true).limit(150);
      const token = await tokenHotmart((k) => Deno.env.get(k));
      if (!token) return json({ error: "sem_credenciais" }, 500);
      const resumo = { teste, contas: 0, liberadas: 0, status_corrigidos: 0 };
      for (const b of bloqueados ?? []) {
        const r = await conferirConta(admin, String(b.user_id), token, false, teste);
        resumo.contas++; if (r.some((x) => x.liberou)) resumo.liberadas++; resumo.status_corrigidos += r.filter((x) => x.mudou).length;
      }
      console.log("hotmart-conciliar lote", JSON.stringify(resumo));
      return json(resumo);
    }
    // who: the session, or the /assinar token
    let userId: string | null = null;
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (jwt) { const { data } = await admin.auth.getUser(jwt); userId = data.user?.id ?? null; }
    if (!userId && typeof corpo.t === "string" && corpo.t.length >= 20) {
      const { data } = await admin.from("assinar_tokens").select("user_id, criado_em").eq("token", corpo.t).maybeSingle();
      if (data && Date.parse(String(data.criado_em)) > Date.now() - 30 * 60_000) userId = String(data.user_id);
    }
    if (!userId) return json({ error: "nao_autorizado" }, 401);

    const caminho = async () => (await admin.rpc("assinatura_caminho_de", { p_user: userId })).data;
    const { count } = await admin.from("hotmart_conciliacoes").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("em", new Date(Date.now() - 60_000).toISOString());
    if ((count ?? 0) > 0) return json({ limitado: true, caminho: await caminho() });

    const { data: perfil } = await admin.from("profiles").select("plan_status, billing_exempt").eq("user_id", userId).maybeSingle();
    const token = await tokenHotmart((k) => Deno.env.get(k));
    const feito = token ? await conferirConta(admin, userId, token, perfil?.plan_status === "active" || !!perfil?.billing_exempt, false) : [];
    const liberado = perfil?.plan_status === "active" || !!perfil?.billing_exempt || feito.some((x) => x.liberou);
    const resultado = { conferidas: feito.length, sem_credenciais: !token, feito };
    await admin.from("hotmart_conciliacoes").insert({ user_id: userId, resultado });
    console.log("hotmart-conciliar", userId, JSON.stringify(resultado));
    return json({ ...resultado, liberado, caminho: await caminho() });
  } catch (e) {
    console.error("hotmart-conciliar", e instanceof Error ? e.message : e);
    return json({ error: "erro_interno" }, 500);
  }
});

type Admin = ReturnType<typeof createClient>;
/** One account: asks Hotmart about each live subscription, records changed statuses and releases
 *  access when Hotmart says it is paid (teste = only reports). */
async function conferirConta(admin: Admin, userId: string, token: string, jaLiberado: boolean, teste: boolean) {
  const { data: subs } = await admin.from("orbis_hotmart_assinatura")
    .select("subscription_id, status_hotmart, oferta_codigo, plano").eq("user_id", userId).in("status_hotmart", VIVAS).limit(5);
  let liberado = jaLiberado;
  const feito: { sub: string; status: string | null; mudou: boolean; liberou: boolean }[] = [];
  for (const s of (subs ?? []) as NossaAssinatura[]) {
    const r = await fetch(`${API}?${new URLSearchParams({ subscriber_code: s.subscription_id })}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) continue;
    const item = ((await r.json()) as { items?: { subscriber_code?: string; status?: string; date_next_charge?: number }[] }).items
      ?.find((i) => i.subscriber_code === s.subscription_id);
    if (!item) continue;
    const d = decidir(s, { status: item.status ?? null, date_next_charge: item.date_next_charge ?? null }, liberado);
    let liberou = false;
    if (!teste && d.gravarStatus) await admin.rpc("hotmart_status_conferido", { p_sub: s.subscription_id, p_status: d.gravarStatus });
    if (!teste && d.liberarAte) {
      const { error } = await admin.rpc("hotmart_acesso_aplicar", { p_user: userId, p_acao: "ativar", p_sub: s.subscription_id, p_purchase: null, p_fim: d.liberarAte, p_complete: false });
      if (!error) {
        liberado = liberou = true;
        if (d.proAte) await admin.rpc("pro_conceder", { p_user: userId, p_origem: "hotmart", p_codigo: s.subscription_id, p_produto: s.oferta_codigo, p_ate: d.proAte });
      }
    }
    feito.push({ sub: s.subscription_id, status: d.gravarStatus ?? s.status_hotmart, mudou: !!d.gravarStatus, liberou: liberou || (teste && !!d.liberarAte) });
  }
  return feito;
}
