// Vant — hotmart-conferir (Rick, 24/10/2026). Roda de hora em hora pelo cron.
// Problema: a Hotmart aceita o cancelamento pela API mas NÃO manda o aviso de volta, então
// o CRM continua mostrando "ativa" e não dá pra saber se pegou. E quem migra pro Pro ou
// paga o checkout duas vezes acaba pagando dois planos.
// O que faz:
//   1) pega quem tem 2+ assinaturas "ativas" no nosso registro (fora banco extra);
//   2) pergunta à Hotmart o status REAL de cada uma e grava no nosso registro quando mudou;
//   3) com as que estão mesmo ativas, cancela pela API: plano padrão de quem tem Pro e
//      assinatura duplicada do mesmo plano (fica a mais antiga). Reembolso NÃO é automático.
// Porta: cabeçalho x-orbis-cron (painel_tokens nome='cron'), igual mp-sync/pluggy.
// Corpo {"teste":true}: só confere e diz o que faria, sem cancelar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cancelarNaHotmart, tokenHotmart } from "../hotmart-webhook/cancelar-padrao.ts";
import { oQueCancelar, type AssinaturaUsuario } from "./regras.ts";

const API = "https://developers.hotmart.com/payments/api/v1/subscriptions";
const MAX_CANCELAR_POR_RODADA = 15;

Deno.serve(async (req) => {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const enviado = req.headers.get("x-orbis-cron") ?? "";
    const { data: tk } = await admin.from("painel_tokens").select("token").eq("nome", "cron").maybeSingle();
    if (!tk?.token || enviado !== String(tk.token)) return json({ error: "nao_autorizado" }, 401);
    const teste = !!(await req.json().catch(() => ({})) as { teste?: boolean }).teste;

    const env = (k: string) => Deno.env.get(k);
    const token = await tokenHotmart(env);
    if (!token) return json({ error: "sem_credenciais_ou_token_recusado" });

    // 1) quem tem 2+ "ativas" no nosso registro
    const { data: linhas, error } = await admin.from("orbis_hotmart_assinatura")
      .select("subscription_id, user_id, oferta_codigo, plano, recorrencia_n, aprovado_em, status_hotmart")
      .in("status_hotmart", ["ACTIVE", "PAST_DUE", "DELAYED"]).not("user_id", "is", null);
    if (error) return json({ error: error.message }, 500);
    const conta = new Map<string, number>();
    for (const l of linhas ?? []) conta.set(l.user_id, (conta.get(l.user_id) ?? 0) + 1);
    const candidatas = (linhas ?? []).filter((l) => (conta.get(l.user_id) ?? 0) > 1);

    // 2) status real na Hotmart
    const ativas: AssinaturaUsuario[] = [];
    const mudou: { subscription_id: string; status: string }[] = [];
    let falhasApi = 0;
    for (const c of candidatas) {
      const r = await fetch(`${API}?${new URLSearchParams({ subscriber_code: c.subscription_id })}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { falhasApi++; continue; }
      const corpo = await r.json() as { items?: { subscriber_code?: string; status?: string }[] };
      const real = (corpo.items ?? []).find((i) => i.subscriber_code === c.subscription_id)?.status ?? null;
      if (!real) { falhasApi++; continue; }
      if (real === "ACTIVE" || real === "DELAYED" || real === "OVERDUE") ativas.push(c as AssinaturaUsuario);
      if (real !== c.status_hotmart) {
        mudou.push({ subscription_id: c.subscription_id, status: real });
        if (!teste) await admin.rpc("hotmart_status_conferido", { p_sub: c.subscription_id, p_status: real });
      }
    }

    // 3) cancelar
    const plano = oQueCancelar(ativas).slice(0, MAX_CANCELAR_POR_RODADA);
    const feitos: typeof plano = [];
    const naMao: { subscription_id: string; motivo: string }[] = [];
    if (!teste) {
      for (const p of plano) {
        const r = await cancelarNaHotmart([p.subscription_id], env);
        if (r.cancelados.length) {
          feitos.push(p);
          await admin.rpc("hotmart_status_conferido", { p_sub: p.subscription_id, p_status: "CANCELLED_BY_SELLER" });
          await admin.from("hotmart_cancelamentos_auto").insert({ subscription_id: p.subscription_id, user_id: p.user_id, motivo: p.motivo, manteve: p.manter });
        } else naMao.push({ subscription_id: p.subscription_id, motivo: r.motivo ?? "erro" });
      }
    }
    const resumo = { teste, conferidas: candidatas.length, mudou, falhasApi, cancelar: plano, cancelados: feitos.length, naMao };
    console.log("hotmart-conferir", JSON.stringify(resumo));
    return json(resumo);
  } catch (e) {
    console.error("hotmart-conferir", (e as Error)?.message);
    return json({ error: "falha" }, 500);
  }
});
