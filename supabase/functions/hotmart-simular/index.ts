// Vant — hotmart-simular (Rick, 26/11/2026). READ-ONLY simulation of the renewal reconciliation:
// for every blocked account with a live Hotmart subscription, asks Hotmart's API (GET only) and
// reports, in COUNTS per group, what hotmart-conciliar would do. It writes nothing anywhere:
// no table, no RPC that changes data, no POST/PATCH to Hotmart (only the OAuth token request).
// Returns no personal data (no names, e-mails or CPF); subscription codes masked. Door: x-orbis-cron.
// 26/11: also lists, for each subscription whose status here differs from Hotmart, the proposed
// change, whether the subscriber still matches the account's buyer and whether the account has
// another (newer) ACTIVE subscription that a change could affect.
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

    const ativaDe = new Map<string, number>();
    for (const x of subs ?? []) if (x.status_hotmart === "ACTIVE" && !BANCO_EXTRA.has(String(x.oferta_codigo ?? ""))) ativaDe.set(String(x.user_id), (ativaDe.get(String(x.user_id)) ?? 0) + 1);
    const conta = new Map<string, number>();
    const registros: Record<string, unknown>[] = [];
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
          const real = String(item?.status ?? "");
          const classe = (x: string) => (["PAST_DUE", "DELAYED", "OVERDUE"].includes(x) ? "ATRASADA" : x);
          if (item && real && classe(real) !== classe(String(s.status_hotmart))) {
            const n = conta.get(String(s.user_id)) ?? conta.size + 1; conta.set(String(s.user_id), n);
            const em = (x?: string | null) => (x ?? "").trim().toLowerCase();
            registros.push({
              conta: n, assinatura: `${String(s.subscription_id).slice(0, 3)}***`, status_vant: s.status_hotmart, status_hotmart: real,
              mudanca_proposta: `registrar ${real} (sem mexer em acesso, prazo ou cobrança)`,
              titular_confere: !!em(s.email) && em(s.email) === em(item.subscriber?.email),
              outra_assinatura_ativa_na_conta: (ativaDe.get(String(s.user_id)) ?? 0) > (s.status_hotmart === "ACTIVE" ? 1 : 0),
            });
          }
        }
      } catch { /* conta como api_falhou */ }
      (porGrupo[g] ??= {})[resultado] = ((porGrupo[g] ??= {})[resultado] ?? 0) + 1;
    }
    const resumo = {
      simulacao: true, em: new Date().toISOString(), assinaturas: alvo.length, contas: new Set(alvo.map((a) => String(a.user_id))).size,
      desatualizadas: { assinaturas: registros.length, contas: conta.size, registros },
      grupos: Object.fromEntries(Object.entries(porGrupo).map(([g, r]) => [g, { contas: contas[g]?.size ?? 0, resultado: r }])),
    };
    console.log("hotmart-simular", JSON.stringify(resumo));
    return json(resumo);
  } catch (e) {
    console.error("hotmart-simular", e instanceof Error ? e.message : e);
    return json({ error: "erro_interno" }, 500);
  }
});
