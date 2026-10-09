// Vant — pluggy-webhook: a Pluggy avisa quando o banco do vendedor atualizou.
// A gente re-consulta as contas e as transacoes NA PLUGGY (nunca confia no corpo
// da notificacao) e guarda so as ENTRADAS (CREDIT) como vendas a conferir.
// Tambem concede o selo: banco conectado e atualizado = verificado.
//
// SEGURANCA: fail-closed. O segredo vem de public.pluggy_config (gerado pela
// funcao pluggy-setup, que tambem cadastra o endereco na Pluggy — ninguem digita
// nada dos dois lados). PLUGGY_WEBHOOK_SECRET ainda funciona como alternativa.
//
// 10/09/2026 — AUTO-CURA. O primeiro banco real (C6 via MeuPluggy) mostrou:
// o webhook item/created chega ANTES do app chamar pluggy-item, e era ignorado
// ("item sem conexao"). Pior: no celular (PWA + OAuth em outra aba) o app pode
// nunca receber o onSuccess do widget — e ai a conexao nunca nascia.
// Agora, se o item nao existe na Vant mas o clientUserId (carimbado por nos no
// connect_token) e de um vendedor Pro, o webhook cria a conexao sozinho.
// O item e conferido NA PLUGGY antes: o clientUserId tem que bater.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { importarEntradas } from "../_shared/pluggy-entradas.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// sempre 200 depois da porta: a Pluggy reenvia sem parar se receber erro
const respond = (body: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ received: true, ...body }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });

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

// 08/10/2026: entries are imported by the SHARED importer (_shared/pluggy-entradas.ts):
// one batched upsert per page instead of one request per transaction (was
// ~17k writes/day), plus is_pix / real time / own-transfer like the robot.
// A brand-new bank pulls 7 days; a refresh pulls 2 (yesterday + today).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // ---- porta: segredo do banco (preferido) ou do env (alternativa)
    const { data: cfg } = await admin.from("pluggy_config").select("webhook_secret").eq("id", "orbis").maybeSingle();
    // deno-lint-ignore no-explicit-any
    const doBanco = String((cfg as any)?.webhook_secret ?? "");
    const doEnv = Deno.env.get("PLUGGY_WEBHOOK_SECRET") ?? "";
    const veio = req.headers.get("x-webhook-secret") ??
      new URL(req.url).searchParams.get("secret") ?? "";

    const passa = (!!doBanco && veio === doBanco) || (!!doEnv && veio === doEnv);
    if (!passa) {
      console.error("pluggy-webhook: segredo invalido ou ausente — rejeitado");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // deno-lint-ignore no-explicit-any
    const payload = await req.json().catch(() => ({} as any));
    console.log("pluggy-webhook", JSON.stringify(payload).slice(0, 300));

    const evento = String(payload?.event ?? "");
    const itemId = String(payload?.itemId ?? payload?.item?.id ?? "");
    const clientUserId = String(payload?.clientUserId ?? "");
    if (!evento || !itemId) return respond();

    const eDeItem = evento.startsWith("item/");
    const eDeTransacao = evento.toLowerCase().startsWith("transactions");
    if (!eDeItem && !eDeTransacao) return respond({ ignorado: evento });

    // deno-lint-ignore no-explicit-any
    let con: any = null;
    {
      const { data } = await admin.from("bank_connections")
        .select("id, user_id").eq("item_id", itemId).maybeSingle();
      con = data;
    }

    const apiKey = await pluggyKey();
    if (!apiKey) {
      console.error("pluggy-webhook: auth falhou");
      return respond();
    }

    // ---- o item, direto da Pluggy (status, banco, dono)
    const itRes = await fetch(`https://api.pluggy.ai/items/${encodeURIComponent(itemId)}`, {
      headers: { "X-API-KEY": apiKey }, signal: AbortSignal.timeout(20000),
    });
    // deno-lint-ignore no-explicit-any
    const item: any = itRes.ok ? await itRes.json().catch(() => null) : null;
    const status = String(item?.status ?? "");
    const dono = String(item?.clientUserId ?? clientUserId);

    // ---- AUTO-CURA: item sem conexao na Vant, mas com dono conhecido e Pro
    if (!con) {
      if (!item || !dono) {
        console.log("pluggy-webhook: item sem conexao e sem dono", itemId);
        return respond();
      }
      const { data: ehPro } = await admin.rpc("orbis_pro_ativo", { p_user: dono });
      if (ehPro !== true) {
        console.log("pluggy-webhook: dono sem Pro, nao cria conexao", dono);
        return respond();
      }
      const { data: nova } = await admin.from("bank_connections").upsert({
        user_id: dono,
        item_id: itemId,
        institution_name: String(item?.connector?.name ?? "Banco"),
        institution_logo: item?.connector?.imageUrl ?? null,
        status: status || "UPDATING",
        updated_at: new Date().toISOString(),
      }, { onConflict: "item_id" }).select("id, user_id").maybeSingle();
      con = nova;
      console.log("pluggy-webhook: conexao criada pela auto-cura", itemId, dono);
      if (!con) return respond();
    } else if (item) {
      // conexao existe: so mantem o status honesto (LOGIN_ERROR, OUTDATED, UPDATED...)
      await admin.from("bank_connections").update({
        status: status || undefined,
        institution_name: item?.connector?.name ?? undefined,
        institution_logo: item?.connector?.imageUrl ?? undefined,
        updated_at: new Date().toISOString(),
      }).eq("id", con.id);
    }

    // eventos de "esperando o usuario" / erro nao trazem extrato novo
    const temExtrato = eDeTransacao || evento === "item/updated" || evento === "item/created" ||
      evento === "item/login_succeeded";
    if (!temExtrato || (status && status !== "UPDATED")) {
      return respond({ status, sem_extrato: true });
    }

    // banco atualizou de verdade → o vendedor vira VERIFICADO
    const { error: eSelo } = await admin.rpc("banco_conceder_selo", { p_user: con.user_id });
    if (eSelo) console.error("pluggy-webhook: selo", eSelo.message);

    const r = await importarEntradas(admin, apiKey, itemId, con.user_id, con.id, evento === "item/created" ? 7 : 2);

    await admin.from("bank_connections").update({
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", con.id);

    // Pix novo pode ter caído num dia já fechado: refaz Pix/cartão/calote desses dias.
    if (r.gravadas > 0) {
      const { error: eRec } = await admin.rpc("banco_reconciliar", { p_user: con.user_id });
      if (eRec) console.error("pluggy-webhook: reconciliar", eRec.message);
    }

    console.log(`pluggy-webhook: ${r.gravadas} entradas para ${con.user_id}`);
    return respond({ gravadas: r.gravadas });
  } catch (e) {
    console.error("pluggy-webhook", e);
    return respond();
  }
});
