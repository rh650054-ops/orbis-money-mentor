// Vant — hotmart-negociar (Rick, 26/11/2026). "Gerar Pix": the overdue subscriber pays the pending
// monthly fee through Hotmart's OFFICIAL installment negotiation (no new subscription, no private Pix).
// Order of every request: our record → a renewal Pix still valid? → Hotmart's real status (GET) →
// Hotmart's purchase history (GET) → the lock (one open negotiation per subscription) → ONE POST.
// The POST is never retried: an answer that did not come back becomes 'incerto' and blocks new
// requests until checked. Never for Pix Automático. Only the last overdue recurrence.
// Doors: · the person's own session, or the 30-minute /assinar token ({ t }) — both CLOSED until the
//          secret HOTMART_NEGOCIAR_ABERTO = "1";
//        · controlled test: header x-orbis-cron (painel_tokens nome='cron') + { teste: true, user_id,
//          assinatura, modo: "conferir" | "gerar", recorrencia, valor } — "gerar" only goes on when
//          Hotmart confirms exactly the recurrence and the amount that were authorised.
// Credentials only from the Supabase panel (HOTMART_*). Token and Pix code are never logged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tokenHotmart, BANCO_EXTRA } from "../hotmart-webhook/cancelar-padrao.ts";
import { decidirPedido, lerResposta, listaDeCompras, type Nossa, type Pedido } from "./regras.ts";

const API = "https://developers.hotmart.com/payments/api/v1";
const ATRASADAS = ["PAST_DUE", "DELAYED", "OVERDUE"];
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
type Admin = ReturnType<typeof createClient>;
const mascara = (s?: string | null) => (s ? `${s.slice(0, 4)}…${s.slice(-3)}` : null);

async function ler(token: string, caminho: string): Promise<{ http: number; corpo: unknown }> {
  const r = await fetch(`${API}${caminho}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  return { http: r.status, corpo: await r.json().catch(() => null) };
}

/** Everything that is read before any charge: our record, a valid renewal Pix, Hotmart's status and history. */
async function preparar(admin: Admin, userId: string, assinatura: string | null, token: string) {
  let q = admin.from("orbis_hotmart_assinatura").select("subscription_id, status_hotmart, oferta_codigo, plano, forma_pagamento, email")
    .eq("user_id", userId).in("status_hotmart", ATRASADAS);
  if (assinatura) q = q.eq("subscription_id", assinatura);
  const { data: subs } = await q.limit(5);
  const nossa = ((subs ?? []) as (Nossa & { oferta_codigo: string | null; plano: string | null })[]).find((s) => !BANCO_EXTRA.has((s.oferta_codigo ?? "").trim()));
  if (!nossa) return { nossa: null, motivo: "sem_assinatura_atrasada" as const };
  // a renewal Pix Hotmart itself generated and that is still valid: show it, never generate another
  const { data: pixAtual } = await admin.rpc("renovacao_pix_de", { p_user: userId });
  const existente = ((pixAtual ?? []) as { subscription_id: string; pix_code: string; vence_em: string; valor: number }[]).find((p) => p.subscription_id === nossa.subscription_id);
  if (existente) return { nossa, motivo: "pix_existente" as const, existente };
  const s = await ler(token, `/subscriptions?${new URLSearchParams({ subscriber_code: nossa.subscription_id })}`);
  const item = ((s.corpo as { items?: { subscriber_code?: string; subscription_id?: number; status?: string; date_next_charge?: number; subscriber?: { email?: string } }[] } | null)?.items ?? [])
    .find((i) => i.subscriber_code === nossa.subscription_id);
  if (s.http !== 200 || !item) return { nossa, motivo: "hotmart_nao_respondeu" as const, http: s.http };
  const c = await ler(token, `/subscriptions/${encodeURIComponent(nossa.subscription_id)}/purchases`);
  if (c.http !== 200) return { nossa, motivo: "hotmart_nao_respondeu" as const, http: c.http };
  const compras = listaDeCompras(c.corpo);
  const pedido = decidirPedido(nossa, { subscription_id: item.subscription_id, status: item.status, date_next_charge: item.date_next_charge, email: item.subscriber?.email }, compras);
  return { nossa, pedido, status_hotmart: item.status ?? null, compras };
}

/** The one and only POST. Reserves first (atomic), records whatever comes back. */
async function gerar(admin: Admin, userId: string, nossa: Nossa, pedido: Extract<Pedido, { acao: "negociar" }>, token: string, origem: string) {
  const { data: reserva, error } = await admin.rpc("hotmart_negociacao_reservar", { p_user: userId, p_assinatura: nossa.subscription_id,
    p_hotmart_id: pedido.hotmart_id, p_recorrencia: pedido.recorrencia, p_valor: pedido.valor, p_proxima: pedido.proxima_cobranca, p_origem: origem });
  if (error) return { acao: "erro", erro: "reserva" };
  const r = reserva as { acao: string; id: string };
  if (r.acao !== "reservado") return reserva as Record<string, unknown>;
  let http: number | null = null, corpo: unknown = null;
  try {
    const resp = await fetch(`${API}/installments/negotiate`, { method: "POST", signal: AbortSignal.timeout(25000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ subscription_id: pedido.hotmart_id, recurrences: [pedido.recorrencia], payment_type: "PIX" }) });
    http = resp.status; corpo = await resp.json().catch(() => null);
  } catch { /* no answer: 'incerto' below, never retried */ }
  const lido = lerResposta(http, corpo);
  await admin.rpc("hotmart_negociacao_gravar", lido.resultado === "gerado"
    ? { p_id: r.id, p_resultado: "gerado", p_transacao: lido.transacao, p_pix_code: lido.pix_code, p_pix_qrcode: lido.pix_qrcode, p_vence: lido.vence_em }
    : { p_id: r.id, p_resultado: lido.resultado, p_erro: lido.erro });
  console.log("hotmart-negociar", userId, JSON.stringify({ resultado: lido.resultado, http, recorrencia: pedido.recorrencia,
    transacao: lido.resultado === "gerado" ? lido.transacao : null, erro: lido.resultado === "gerado" ? null : lido.erro }));
  return lido.resultado === "gerado"
    ? { acao: "gerado", id: r.id, transacao: lido.transacao, pix_code: lido.pix_code, pix_qrcode: lido.pix_qrcode, vence_em: lido.vence_em,
        valor: lido.valor_no_pix ?? pedido.valor, valor_da_recorrencia: pedido.valor, valor_no_pix: lido.valor_no_pix, recorrencia: pedido.recorrencia }
    : { acao: lido.resultado, erro: lido.erro };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const corpo = await req.json().catch(() => ({})) as { teste?: boolean; user_id?: string; assinatura?: string; modo?: string; recorrencia?: number; valor?: number; t?: string };
    const cron = req.headers.get("x-orbis-cron") ?? "";

    // ---- controlled test (Rick's explicit authorisation for ONE subscription)
    if (cron && corpo.teste) {
      const { data: tk } = await admin.from("painel_tokens").select("token").eq("nome", "cron").maybeSingle();
      if (!tk?.token || cron !== String(tk.token)) return json({ error: "nao_autorizado" }, 401);
      if (!corpo.user_id || !corpo.assinatura || !["conferir", "gerar"].includes(corpo.modo ?? "")) return json({ error: "diga_conta_assinatura_e_modo" }, 400);
      const token = await tokenHotmart((k) => Deno.env.get(k));
      if (!token) return json({ error: "sem_credenciais" }, 500);
      const p = await preparar(admin, corpo.user_id, corpo.assinatura, token);
      const visto = { motivo: "motivo" in p ? p.motivo : null, status_hotmart: "status_hotmart" in p ? p.status_hotmart : null, pedido: "pedido" in p ? p.pedido : null,
        compras: ("compras" in p ? p.compras ?? [] : []).map((c) => ({ transacao: mascara(c.transaction), status: c.status ?? null, recorrencia: c.recurrency_number ?? null,
          tipo: c.payment_type ?? null, valor: c.price?.value ?? null, moeda: c.price?.currency_code ?? null })) };
      if (corpo.modo === "conferir") return json({ modo: "conferir", ...visto });
      if (!("pedido" in p) || !p.pedido || p.pedido.acao !== "negociar") return json({ modo: "gerar", gerou: false, ...visto });
      // the authorisation names a recurrence and an amount: anything else stops here, before any charge
      if (p.pedido.recorrencia !== corpo.recorrencia || Math.abs(p.pedido.valor - Number(corpo.valor)) > 0.005) {
        return json({ modo: "gerar", gerou: false, ...visto, motivo: "nao_bate_com_o_autorizado" });
      }
      const g = await gerar(admin, corpo.user_id, p.nossa, p.pedido, token, "teste") as Record<string, unknown>;
      let host: string | null = null;
      try { host = g.pix_qrcode ? new URL(String(g.pix_qrcode)).host : null; } catch { host = "nao_e_link"; }
      // the Pix code stays in the table: the test report only says what came back
      return json({ modo: "gerar", gerou: g.acao === "gerado", acao: g.acao, erro: g.erro ?? null, transacao: g.transacao ?? null, vence_em: g.vence_em ?? null,
        valor_da_recorrencia: g.valor_da_recorrencia ?? null, valor_no_pix: g.valor_no_pix ?? null, pix_tamanho: g.pix_code ? String(g.pix_code).length : 0,
        qrcode: host, recorrencia: p.pedido.recorrencia, atrasadas: p.pedido.atrasadas });
    }

    // ---- the person's own session
    if (Deno.env.get("HOTMART_NEGOCIAR_ABERTO") !== "1") return json({ error: "indisponivel" }, 403);
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: sessao } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
    let userId: string | null = sessao.user?.id ?? null;
    // /assinar?t=… opened from the store app (no session): the same 30-minute token as "Já paguei"
    if (!userId && typeof corpo.t === "string" && corpo.t.length >= 20) {
      const { data } = await admin.from("assinar_tokens").select("user_id, criado_em").eq("token", corpo.t).maybeSingle();
      if (data && Date.parse(String(data.criado_em)) > Date.now() - 30 * 60_000) userId = String(data.user_id);
    }
    if (!userId) return json({ error: "nao_autorizado" }, 401);
    const token = await tokenHotmart((k) => Deno.env.get(k));
    if (!token) return json({ acao: "indisponivel" });
    const p = await preparar(admin, userId, null, token);
    if ("motivo" in p && p.motivo === "pix_existente") return json({ acao: "pix_existente", pix_code: p.existente.pix_code, vence_em: p.existente.vence_em, valor: p.existente.valor });
    if (!("pedido" in p) || !p.pedido) return json({ acao: "recusar", motivo: "motivo" in p ? p.motivo : "indisponivel" });
    if (p.pedido.acao !== "negociar") return json(p.pedido);
    return json(await gerar(admin, userId, p.nossa, p.pedido, token, "app"));
  } catch (e) {
    console.error("hotmart-negociar", e instanceof Error ? e.message : e);
    return json({ error: "erro_interno" }, 500);
  }
});
