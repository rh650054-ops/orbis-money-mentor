// Vant — hotmart-reembolsar (Rick, 24/10/2026, reembolso com UM CLIQUE).
// Chamada pelo CRM (botão "Reembolsar") com o login do admin. Só reembolsa uma cobrança
// que esteja na lista admin_reembolsos_sugeridos (duplicada / plano antigo cobrado depois
// do Pro) e ainda não reembolsada. Nunca reembolsa um valor qualquer.
// API Hotmart: PUT /payments/api/v1/sales/{transaction}/refund. Credenciais nos secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tokenHotmart } from "../hotmart-webhook/cancelar-padrao.ts";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const REFUND = (tx: string) => `https://developers.hotmart.com/payments/api/v1/sales/${encodeURIComponent(tx)}/refund`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const auth = req.headers.get("Authorization") ?? "";
    // como o admin logado: a lista já filtra por is_orbis_admin()
    const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (!user) return json({ success: false, error: "sem login" }, 401);

    const { purchase_id } = await req.json().catch(() => ({})) as { purchase_id?: string };
    if (!purchase_id) return json({ success: false, error: "falta a cobrança" }, 400);

    const { data: lista, error: lErr } = await comoUsuario.rpc("admin_reembolsos_sugeridos");
    if (lErr) return json({ success: false, error: lErr.message }, 403);
    // deno-lint-ignore no-explicit-any
    const item = ((lista ?? []) as any[]).find((r) => r.purchase_id === purchase_id);
    if (!item) return json({ success: false, error: "essa cobrança não está na lista de reembolsos" }, 403);
    if (item.reembolsado_em) return json({ success: false, error: "já reembolsada" }, 409);

    const token = await tokenHotmart((k) => Deno.env.get(k));
    if (!token) return json({ success: false, error: "sem credenciais da Hotmart" }, 500);
    const r = await fetch(REFUND(purchase_id), { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const corpo = await r.text();
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    if (!r.ok) {
      console.warn("hotmart-reembolsar", purchase_id, r.status, corpo.slice(0, 300));
      return json({ success: false, error: `A Hotmart recusou (${r.status}). Pode ter passado do prazo de garantia: faça pelo painel.` }, 502);
    }
    await admin.from("hotmart_reembolsos").insert({
      purchase_id, user_id: item.user_id, subscription_id: item.subscription_id, valor: item.valor,
      motivo: item.motivo, por: user.id, resultado: "ok",
    });
    console.log("hotmart-reembolsar ok", purchase_id);
    return json({ success: true });
  } catch (e) {
    console.error("hotmart-reembolsar", (e as Error)?.message);
    return json({ success: false, error: "falha" }, 500);
  }
});
