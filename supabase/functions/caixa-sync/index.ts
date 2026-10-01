// Vant — caixa-sync (Caixa da Vant, painel dos socios)
// Duas acoes, sempre por um socio logado (caixa_eh_socio):
//   { acao: "ia" }    -> puxa o CONSUMO das APIs direto da fonte (Anthropic Admin API e
//                        OpenAI Costs API), dia a dia, e grava em caixa_lancamentos como
//                        origem anthropic/openai com afeta_saldo=false (consumo do credito
//                        pre-pago; o dinheiro saiu na recarga, que e lancada a mao).
//   { acao: "dicas" } -> monta o retrato do caixa + numeros do app e pede 3 dicas e
//                        alertas pra IA. Guarda em caixa_config('dicas').
// Segredos (Supabase > Edge Functions > Secrets): ANTHROPIC_ADMIN_KEY (chave "Admin"
// do console da Anthropic, nao a chave normal), OPENAI_ADMIN_KEY (chave "Admin" da
// OpenAI), ANTHROPIC_API_KEY (ja existe, pras dicas).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const hojeBR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const diasAtras = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

// ---------- Anthropic: /v1/organizations/cost_report (amount em centavos de dolar) ----------
async function custosAnthropic(key: string, desde: string): Promise<Map<string, number>> {
  const porDia = new Map<string, number>();
  let page: string | null = null;
  for (let i = 0; i < 10; i++) {
    const url = new URL("https://api.anthropic.com/v1/organizations/cost_report");
    url.searchParams.set("starting_at", `${desde}T00:00:00Z`);
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");
    if (page) url.searchParams.set("page", page);
    const r = await fetch(url, { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`anthropic_${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`);
    const j = await r.json();
    for (const b of (j?.data ?? []) as any[]) {
      const dia = String(b?.starting_at ?? "").slice(0, 10);
      if (!dia) continue;
      let usd = 0;
      for (const res of (b?.results ?? []) as any[]) {
        const amt = Number(res?.amount);
        if (Number.isFinite(amt)) usd += amt / 100; // centavos -> dolares
      }
      porDia.set(dia, (porDia.get(dia) ?? 0) + usd);
    }
    if (!j?.has_more || !j?.next_page) break;
    page = String(j.next_page);
  }
  return porDia;
}

// ---------- OpenAI: /v1/organization/costs (amount.value em dolares) ----------
async function custosOpenAI(key: string, desde: string): Promise<Map<string, number>> {
  const porDia = new Map<string, number>();
  const start = Math.floor(new Date(`${desde}T00:00:00Z`).getTime() / 1000);
  let page: string | null = null;
  for (let i = 0; i < 10; i++) {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(start));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");
    if (page) url.searchParams.set("page", page);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`openai_${r.status}: ${(await r.text().catch(() => "")).slice(0, 160)}`);
    const j = await r.json();
    for (const b of (j?.data ?? []) as any[]) {
      const dia = new Date(Number(b?.start_time ?? 0) * 1000).toISOString().slice(0, 10);
      let usd = 0;
      for (const res of (b?.results ?? []) as any[]) {
        const v = Number(res?.amount?.value);
        if (Number.isFinite(v)) usd += v;
      }
      porDia.set(dia, (porDia.get(dia) ?? 0) + usd);
    }
    if (!j?.has_more || !j?.next_page) break;
    page = String(j.next_page);
  }
  return porDia;
}

function extrairJson(raw: string): any | null {
  try { return JSON.parse(raw); } catch { /* segue */ }
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* segue */ } }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const acao = body?.acao === "dicas" ? "dicas" : "ia";

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "nao_autenticado" }, 401);
    // Cliente do USUARIO: tudo que ele grava passa pelo RLS e a auditoria registra quem foi.
    const supa = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } });
    const { data: ehSocio } = await supa.rpc("caixa_eh_socio");
    if (ehSocio !== true) return json({ error: "sem_acesso" }, 403);

    const { data: cfgRows } = await supa.from("caixa_config").select("chave, valor");
    const cfg: Record<string, any> = {};
    for (const r of (cfgRows ?? []) as any[]) cfg[r.chave] = r.valor;
    const cambio = Number(cfg.cambio_usd) > 0 ? Number(cfg.cambio_usd) : 5.5;

    // ===================== IA: consumo direto das APIs =====================
    if (acao === "ia") {
      // Comeca do zero: consumo so a partir do dia da abertura do caixa (Rick, 30/09).
      const abertura = typeof cfg.aberto_em === "string"
        ? new Date(cfg.aberto_em).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : diasAtras(35);
      const desde = body?.desde && /^\d{4}-\d{2}-\d{2}$/.test(body.desde) && body.desde >= abertura ? body.desde : abertura;
      const estado: Record<string, any> = { quando: new Date().toISOString(), cambio };
      const provedores: Array<["anthropic" | "openai", string | undefined, (k: string, d: string) => Promise<Map<string, number>>]> = [
        ["anthropic", Deno.env.get("ANTHROPIC_ADMIN_KEY"), custosAnthropic],
        ["openai", Deno.env.get("OPENAI_ADMIN_KEY"), custosOpenAI],
      ];
      for (const [nome, key, fn] of provedores) {
        if (!key) { estado[nome] = { ok: false, erro: "chave_nao_configurada" }; continue; }
        try {
          const porDia = await fn(key, desde);
          const rows: any[] = [];
          let totalUsd = 0;
          for (const [dia, usd] of porDia) {
            if (usd <= 0 || dia > hojeBR()) continue;
            totalUsd += usd;
            rows.push({
              data: dia, tipo: "saida", valor: -Math.round(usd * cambio * 100) / 100,
              descricao: `Consumo ${nome === "anthropic" ? "Anthropic" : "OpenAI"} — US$ ${usd.toFixed(2)}`,
              categoria: "ia", origem: nome, status: "pago", afeta_saldo: false,
              moeda_original: "USD", valor_original: Math.round(usd * 10000) / 10000, cambio,
              chave_externa: `${nome}:${dia}`,
            });
          }
          if (rows.length > 0) {
            const { error } = await supa.from("caixa_lancamentos").upsert(rows, { onConflict: "chave_externa" });
            if (error) throw new Error(`gravar: ${error.message}`);
          }
          estado[nome] = { ok: true, dias: rows.length, total_usd: Math.round(totalUsd * 100) / 100, desde };
        } catch (e) {
          estado[nome] = { ok: false, erro: String((e as Error)?.message ?? e).slice(0, 200) };
        }
      }
      await supa.from("caixa_config").upsert({ chave: "ia_sync", valor: estado, atualizado_em: new Date().toISOString() });
      return json({ ok: true, estado });
    }

    // ===================== DICAS: retrato do caixa + numeros do app -> IA =====================
    const { data: resumo, error: eRes } = await supa.rpc("caixa_resumo", { p_mes: null });
    if (eRes || !resumo) return json({ error: "resumo_falhou" }, 500);
    const r = resumo as any;

    // Numeros do app (service role: sao agregados, sem dado de vendedor).
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const iniMes = `${hojeBR().slice(0, 7)}-01`;
    const [ativos, vendasMes, cancelMes, iaMes] = await Promise.all([
      admin.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      admin.from("hotmart_eventos").select("valor, eh_renovacao").eq("event_type", "PURCHASE_APPROVED").gte("recebido_em", iniMes),
      admin.from("hotmart_eventos").select("id", { count: "exact", head: true }).in("event_type", ["SUBSCRIPTION_CANCELLATION", "PURCHASE_CANCELED"]).gte("recebido_em", iniMes),
      admin.from("ai_usage").select("feature, count").gte("dia", iniMes),
    ]);
    const vendas = (vendasMes.data ?? []) as any[];
    const bruto = vendas.reduce((a, v) => a + (Number(v.valor) || 0), 0);
    const renov = vendas.filter((v) => v.eh_renovacao).length;
    const chamadas = ((iaMes.data ?? []) as any[]).reduce((a, v) => a + (Number(v.count) || 0), 0);
    const app = { assinantes_ativos: ativos.count ?? 0, vendas_mes: vendas.length, renovacoes_mes: renov, bruto_mes: Math.round(bruto * 100) / 100,
      cancelamentos_mes: cancelMes.count ?? 0, chamadas_ia_mes: chamadas, preco: 29.9, liquido_por_venda: 24.45 };

    const retrato = {
      hoje: r.hoje, saldo: r.saldo, a_pagar: r.a_pagar, entrou_mes: r.entrou, saiu_mes: r.saiu, saiu_mes_anterior: r.saiu_anterior,
      media_gasto_dia_30d: r.media_dia_30, hotmart_a_receber: r.config?.hotmart_a_receber ?? null, tetos: r.config?.tetos ?? null,
      gastos_por_categoria: r.categorias, ia: r.ia, cambio_usd: cambio,
      influenciadores: (r.influenciadores ?? []).map((i: any) => ({ nome: i.nome, tipo: i.tipo, combinado: i.combinado, valor: i.valor, periodicidade: i.periodicidade, vence: i.proximo_vencimento, status: i.status, tem_pix: !!i.pix_chave, pago_mes: i.pago_mes })),
      app,
    };

    const key = Deno.env.get("ANTHROPIC_API_KEY");
    const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";
    let saida: any = null;
    if (key) {
      const promptEstatico = `Voce e o CFO de bolso da Vant, um app brasileiro pra vendedores de rua (assinatura de R$ 29,90/mes vendida pela Hotmart; de cada venda sobram R$ 24,45 liquidos pra Vant). O saldo do caixa comeca no saldo da Hotmart e cada venda aprovada entra sozinha (categoria vendas_hotmart). Os socios (Rick e Mohamed) vao te mandar o retrato do caixa da empresa em JSON. Sua tarefa: 3 dicas curtas e 0 a 3 alertas, em portugues do Brasil, tom direto de socio pra socio, sem enrolacao, SEM inventar numero — use so o que esta no JSON e as contas que der pra fazer com ele (mostre a conta quando fizer). Priorize: (1) quanto tempo o saldo aguenta no ritmo atual, (2) o que mais pesa e da pra cortar, (3) credito de IA (recargas x consumo: quando acaba), (4) influenciador vencendo / sem Pix, (5) churn x novos assinantes. Cada dica: "titulo" (ate 8 palavras), "texto" (ate 45 palavras), "acao" (uma frase imperativa curta). Cada alerta: "nivel" ("alto"|"medio"), "texto" (ate 25 palavras).
Responda SOMENTE um JSON valido: {"dicas":[{"titulo":"","texto":"","acao":""}],"alertas":[{"nivel":"alto","texto":""}]}`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ model, max_tokens: 1200, messages: [{ role: "user", content: [
          { type: "text", text: promptEstatico, cache_control: { type: "ephemeral" } },
          { type: "text", text: `RETRATO DO CAIXA (JSON):\n${JSON.stringify(retrato)}` },
        ] }] }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = (data?.content ?? []).map((b: any) => b?.text || "").join("").trim();
        saida = extrairJson(raw);
      } else {
        console.error("caixa-sync dicas: claude", res.status, (await res.text().catch(() => "")).slice(0, 200));
      }
    }
    // Sem IA (ou resposta quebrada): dicas calculadas na regra, pra tela nunca ficar vazia.
    if (!saida || !Array.isArray(saida.dicas)) {
      const dias = r.media_dia_30 > 0 ? Math.floor(r.saldo / r.media_dia_30) : null;
      // Sem IA: leitura por regra (nunca deixa a tela vazia nem mostra JSON cru).
      saida = { dicas: [
        { titulo: "Quanto tempo o caixa aguenta", texto: dias === null ? `Saldo de R$ ${Number(r.saldo).toFixed(2)} e ainda sem gasto suficiente pra medir o ritmo.` : `Saldo de R$ ${Number(r.saldo).toFixed(2)} ÷ R$ ${Number(r.media_dia_30).toFixed(2)} por dia = ${dias} dias no ritmo dos últimos 30 dias.`, acao: "Lance todo gasto no dia em que sair." },
      ], alertas: [], fonte: "regra" };
    }
    // So passa texto limpo pra tela (nada de JSON cru, como aconteceu na Dica da Vant).
    const txt = (v: unknown, max: number) => String(v ?? "").replace(/[{}\[\]"`]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
    const dicas = ((saida.dicas ?? []) as any[]).map((d) => ({ titulo: txt(d?.titulo, 80), texto: txt(d?.texto, 360), acao: txt(d?.acao, 120) }))
      .filter((d) => d.titulo && d.texto).slice(0, 3);
    const alertas = ((saida.alertas ?? []) as any[]).map((a) => ({ nivel: a?.nivel === "alto" ? "alto" : "medio", texto: txt(a?.texto, 220) }))
      .filter((a) => a.texto).slice(0, 3);
    const pacote = { geradas_em: new Date().toISOString(), dicas, alertas, fonte: saida.fonte ?? "ia", app };
    await supa.from("caixa_config").upsert({ chave: "dicas", valor: pacote, atualizado_em: new Date().toISOString() });
    return json({ ok: true, ...pacote });
  } catch (e) {
    console.error("caixa-sync erro", String(e).slice(0, 300));
    return json({ error: "erro_interno" }, 500);
  }
});
