// Vant — hotmart-simular (Rick, 26/11/2026). READ-ONLY simulation of the renewal reconciliation:
// for every blocked account with a live Hotmart subscription, asks Hotmart's API (GET only) and
// reports, in COUNTS per group, what hotmart-conciliar would do. It writes nothing anywhere:
// no table, no RPC that changes data, no POST/PATCH to Hotmart (only the OAuth token request).
// Returns no personal data (no names, e-mails, CPF or codes). Door: x-orbis-cron (painel_tokens).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tokenHotmart } from "../hotmart-webhook/cancelar-padrao.ts";
import { classificar, type NossaAssinatura } from "./regras.ts";

const API = "https://developers.hotmart.com/payments/api/v1/subscriptions";
const VIVAS = ["ACTIVE", "PAST_DUE", "DELAYED", "OVERDUE", "STARTED"];

Deno.serve(async (req) => {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: tk } = await admin.from("painel_tokens").select("token").eq("nome", "cron").maybeSingle();
    if (!tk?.token || (req.headers.get("x-orbis-cron") ?? "") !== String(tk.token)) return json({ error: "nao_autorizado" }, 401);
    const token = await tokenHotmart((k) => Deno.env.get(k));
    if (!token) return json({ error: "sem_credenciais" }, 500);

    const { data: subs } = await admin.from("orbis_hotmart_assinatura")
      .select("subscription_id, user_id, status_hotmart, oferta_codigo, plano, email").in("status_hotmart", VIVAS).not("user_id", "is", null).limit(1000);
    const ids = [...new Set((subs ?? []).map((s) => String(s.user_id)))];
    const { data: perfis } = await admin.from("profiles").select("user_id, plan_status, billing_exempt").in("user_id", ids);
    const bloqueado = new Set((perfis ?? []).filter((p) => p.plan_status !== "active" && !p.billing_exempt).map((p) => String(p.user_id)));
    const BANCO_EXTRA = new Set(["3nnrr1xn", "otgozkn9"]);
    const alvo = (subs ?? []).filter((s) => bloqueado.has(String(s.user_id)) && !BANCO_EXTRA.has(String(s.oferta_codigo ?? "")));

    const porGrupo: Record<string, Record<string, number>> = {};
    const contas: Record<string, Set<string>> = {};
    for (const s of alvo) {
      const g = String(s.status_hotmart);
      (contas[g] ??= new Set()).add(String(s.user_id));
      let resultado = "api_falhou";
      try {
        const r = await fetch(`${API}?${new URLSearchParams({ subscriber_code: String(s.subscription_id) })}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
        if (r.ok) {
          const item = ((await r.json()) as { items?: { subscriber_code?: string; status?: string; date_next_charge?: number; subscriber?: { email?: string } }[] }).items
            ?.find((i) => i.subscriber_code === s.subscription_id);
          resultado = item ? classificar(s as NossaAssinatura, { status: item.status ?? null, date_next_charge: item.date_next_charge ?? null, email: item.subscriber?.email ?? null }) : "nao_encontrada_na_hotmart";
        }
      } catch { /* conta como api_falhou */ }
      (porGrupo[g] ??= {})[resultado] = ((porGrupo[g] ??= {})[resultado] ?? 0) + 1;
    }
    const resumo = {
      simulacao: true, em: new Date().toISOString(), assinaturas: alvo.length,
      grupos: Object.fromEntries(Object.entries(porGrupo).map(([g, r]) => [g, { contas: contas[g]?.size ?? 0, resultado: r }])),
    };
    console.log("hotmart-simular", JSON.stringify(resumo));
    return json(resumo);
  } catch (e) {
    console.error("hotmart-simular", e instanceof Error ? e.message : e);
    return json({ error: "erro_interno" }, 500);
  }
});
