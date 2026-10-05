import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tira {titulo, texto} do que a IA devolveu SEM deixar JSON vazar pra tela.
// 1) JSON válido → usa. 2) JSON quebrado (quebra de linha dentro da string, aspas sem
// escape, resposta cortada) → pesca os campos por regex, aceitando string sem fechar.
// 3) Nada disso → texto puro, com chaves/aspas/"titulo:" varridos. (Bug visto em
// 29/09: o card mostrava '{"titulo": "Lucro de R$180...' porque o parse falhava e o
// fallback dividia o JSON cru por frases.)
function extrairDica(raw: string): { titulo: string; texto: string } {
  const limpaStr = (v: string) => v.replace(/\\n/g, " ").replace(/\\"/g, '"').replace(/\s+/g, " ").trim();
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    const j = m ? JSON.parse(m[0]) : null;
    const t = String(j?.titulo ?? "").trim(), x = String(j?.texto ?? "").trim();
    if (x) return { titulo: t, texto: x };
  } catch { /* segue pro regex */ }
  const rt = raw.match(/"titulo"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
  const rx = raw.match(/"texto"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
  if (rx && rx[1]?.trim()) return { titulo: limpaStr(rt?.[1] ?? ""), texto: limpaStr(rx[1]) };
  const limpo = raw.replace(/[{}\[\]]/g, " ").replace(/"(titulo|texto)"\s*:/gi, " ").replace(/[*_#`"]/g, "").replace(/\s+/g, " ").trim();
  const partes = limpo.split(/(?<=[.!?])\s+/);
  const titulo = (partes.shift() ?? limpo).slice(0, 90);
  return { titulo, texto: partes.join(" ").slice(0, 400) || limpo.slice(0, 400) };
}

// Chama o Gemini (mesma chave gratis do chat). Recebe system + user prompt e devolve texto.
async function callGemini(systemPrompt: string, userPrompt: string, jsonMode = false): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY não está configurada no backend.");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: jsonMode ? 2048 : 1024,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });

  // Até 3 tentativas: o plano grátis do Gemini estoura o limite por minuto (429) fácil.
  // Em 429/503/500, espera um pouco e tenta de novo antes de desistir.
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(jsonMode ? 30000 : 20000),
      body: payload,
    });

    if (res.ok) {
      const json = await res.json();
      const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error("Resposta inválida da IA.");
      return content;
    }

    lastStatus = res.status;
    const err = await res.text();
    if ((res.status === 429 || res.status === 503 || res.status === 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); // 1.5s, depois 3s
      continue;
    }
    if (res.status === 429) throw new Error("Limite do Gemini (plano grátis) atingido. Espere ~1 min e tente de novo.");
    throw new Error(`Erro na IA (${res.status}): ${err.substring(0, 200)}`);
  }
  throw new Error(`Limite do Gemini (plano grátis) atingido (${lastStatus}). Espere ~1 min e tente de novo.`);
}

// ---- Cerebras (texto, grátis 1M tokens/dia). Tenta primeiro; cai no Gemini se faltar chave/erro. ----
async function callCerebras(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = Deno.env.get("CEREBRAS_API_KEY");
  if (!key) throw new Error("sem_cerebras_key");
  const model = Deno.env.get("CEREBRAS_MODEL") ?? "gpt-oss-120b";
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${key}` },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`cerebras_${res.status}: ${errBody.slice(0, 250)}`);
  }
  const j = await res.json();
  const content = j?.choices?.[0]?.message?.content?.toString().trim();
  if (!content) throw new Error("cerebras_vazio");
  return content;
}

let custoUser: string | null = null; // dono do relatório, pro medidor de gasto

// ---- Claude (Anthropic, texto). Primeiro da fila; cai no Cerebras/Gemini se faltar chave/erro/credito. ----
async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("sem_anthropic_key");
  // Relatórios usam o Sonnet (o mesmo cérebro do chat). Antes era o Haiku — o modelo
  // mais simples — e com só 4 ou 5 números no pedido: o texto saía igual pra todo mundo.
  // Secret ANTHROPIC_MODEL_RELATORIO troca o modelo sem mexer no código.
  const model = Deno.env.get("ANTHROPIC_MODEL_RELATORIO") ?? "claude-sonnet-5";
  // Os modelos da linha 5 recusam "temperature" com 400 — só manda pros antigos.
  const aceitaTemp = /haiku-4|sonnet-4|opus-4/.test(model);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(40000),
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      ...(aceitaTemp ? { temperature: 0.7 } : {}),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`claude_${res.status}: ${errBody.slice(0, 250)}`);
  }
  const j = await res.json();
  registrarCusto(model, j?.usage);
  const content = ((j?.content ?? []).map((b: any) => b?.text || "").join("")).trim();
  if (!content) throw new Error("claude_vazio");
  return content;
}

// Medidor: mesmo painel de gasto do chat (ai_custos). Nunca atrapalha o relatório.
function registrarCusto(model: string, u: any) {
  try {
    if (!u) return;
    const pr = model.includes("opus") ? { e: 5, s: 25 } : model.includes("haiku") ? { e: 1, s: 5 } : { e: 2, s: 10 };
    const ent = Number(u.input_tokens) || 0, sai = Number(u.output_tokens) || 0;
    const a = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const p = Promise.resolve(a.from("ai_custos").insert({
      user_id: custoUser, servico: "claude_relatorio", modelo: model, qtd: ent + sai, unidade: "tokens",
      custo_usd: Math.round((ent * pr.e / 1e6 + sai * pr.s / 1e6) * 1e6) / 1e6,
    })).then(() => {}, () => {});
    const er = (globalThis as any).EdgeRuntime;
    if (er?.waitUntil) er.waitUntil(p);
  } catch { /* noop */ }
}

// Histórico REAL do vendedor, buscado aqui no servidor (com o token dele, RLS):
// últimos 30 dias de venda, melhores dias da semana e horários, o que ele vende,
// onde, produtos que mais saem e o que a memória do mentor já sabe dele.
// É isso que tira o relatório do genérico: a IA compara hoje com o normal DELE.
async function historicoVendedor(sb: any, userId: string): Promise<string> {
  try {
    const hojeBR = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    const d = (n: number) => new Date(Date.parse(hojeBR + "T12:00:00Z") - n * 864e5).toISOString().slice(0, 10);
    const [vR, hR, pR, prR, mR] = await Promise.all([
      sb.from("daily_sales").select("date,total_profit,total_debt,cash_sales,card_sales,pix_sales")
        .eq("user_id", userId).gte("date", d(29)).order("date", { ascending: true }),
      sb.from("hourly_goal_blocks").select("hour_label,achieved_amount").eq("user_id", userId).gte("created_at", d(13) + "T00:00:00Z"),
      sb.from("profiles").select("nickname,what_i_sell,where_i_sell,city,monthly_goal,streak_days").eq("user_id", userId).maybeSingle(),
      sb.from("product_sales_log").select("product_id,quantity,total_amount").eq("user_id", userId).gte("created_at", d(29) + "T00:00:00Z"),
      sb.from("ai_memoria").select("fato").eq("user_id", userId).eq("ativo", true).order("created_at", { ascending: false }).limit(8),
    ]);
    const L: string[] = [];
    const p = pR?.data;
    if (p) {
      const quem = [p.nickname, p.what_i_sell && `vende ${p.what_i_sell}`, p.where_i_sell && `em ${p.where_i_sell}`, p.city].filter(Boolean).join(", ");
      if (quem) L.push(`QUEM É: ${quem}.`);
      if (Number(p.monthly_goal) > 0) L.push(`Meta do mês: R$ ${Number(p.monthly_goal).toFixed(0)}. Sequência: ${p.streak_days ?? 0} dias.`);
    }
    const todos = (vR?.data ?? []) as any[];
    const vendas = todos.filter((x) => Number(x.total_profit) > 0);
    if (vendas.length) {
      const tot = vendas.reduce((s, x) => s + Number(x.total_profit || 0), 0);
      const ult = vendas.slice(-10).map((x) => `${String(x.date).slice(8, 10)}/${String(x.date).slice(5, 7)} R$${Number(x.total_profit).toFixed(0)}`).join(", ");
      L.push(`ÚLTIMOS 30 DIAS: ${vendas.length} dias de rua, R$ ${tot.toFixed(0)} no total, média R$ ${(tot / vendas.length).toFixed(0)}/dia, melhor dia R$ ${Math.max(...vendas.map((x) => Number(x.total_profit))).toFixed(0)}.`);
      L.push(`Dias recentes: ${ult}.`);
      const sem = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
      const porDia: Record<number, number[]> = {};
      for (const x of vendas) { const w = new Date(String(x.date) + "T12:00:00Z").getUTCDay(); (porDia[w] ??= []).push(Number(x.total_profit)); }
      const rank = Object.entries(porDia).map(([w, a]) => [sem[Number(w)], a.reduce((s, v) => s + v, 0) / a.length] as const).sort((a, b) => b[1] - a[1]);
      if (rank.length >= 2) L.push(`Por dia da semana (média): ${rank.map(([n, v]) => `${n} R$${v.toFixed(0)}`).join(", ")}.`);
      const pix = vendas.reduce((s, x) => s + Number(x.pix_sales || 0), 0);
      const din = vendas.reduce((s, x) => s + Number(x.cash_sales || 0), 0);
      const cal = todos.reduce((s, x) => s + Number(x.total_debt || 0), 0);
      if (pix + din > 0) L.push(`Como recebe: Pix R$ ${pix.toFixed(0)}, dinheiro R$ ${din.toFixed(0)}${cal > 0 ? `, fiado ainda pra cair R$ ${cal.toFixed(0)}` : ""}.`);
    }
    const horas: Record<string, number[]> = {};
    for (const h of (hR?.data ?? []) as any[]) if (h.hour_label) (horas[h.hour_label] ??= []).push(Number(h.achieved_amount || 0));
    const hr = Object.entries(horas).map(([k, a]) => [k, a.reduce((s, v) => s + v, 0) / a.length] as const).sort((a, b) => b[1] - a[1]).slice(0, 4);
    if (hr.length) L.push(`Horários que mais rendem (14 dias): ${hr.map(([k, v]) => `${k} R$${v.toFixed(0)}`).join(", ")}.`);
    const logs = (prR?.data ?? []) as any[];
    if (logs.length) {
      const ids = [...new Set(logs.map((x) => x.product_id).filter(Boolean))];
      const { data: nomes } = ids.length ? await sb.from("products").select("id,name").in("id", ids) : { data: [] };
      const nome = new Map(((nomes ?? []) as any[]).map((x) => [x.id, x.name]));
      const prod: Record<string, { q: number; v: number }> = {};
      for (const x of logs) { const n = nome.get(x.product_id) ?? "produto"; prod[n] ??= { q: 0, v: 0 }; prod[n].q += Number(x.quantity || 0); prod[n].v += Number(x.total_amount || 0); }
      const top = Object.entries(prod).sort((a, b) => b[1].v - a[1].v).slice(0, 4);
      if (top.length) L.push(`Produtos que mais saem (30 dias): ${top.map(([n, o]) => `${n} ${o.q}un R$${o.v.toFixed(0)}`).join(", ")}.`);
    }
    const mem = ((mR?.data ?? []) as any[]).map((x) => x.fato).filter(Boolean);
    if (mem.length) L.push(`O QUE O MENTOR JÁ SABE DELE: ${mem.join(" | ")}.`);
    return L.length ? `\n\nHISTÓRICO REAL DELE (compare e personalize — cite pelo menos um destes números):\n${L.join("\n")}` : "";
  } catch (e) {
    console.error("historicoVendedor falhou:", String(e).slice(0, 160));
    return "";
  }
}


// Texto: Claude primeiro; Cerebras de reserva; Gemini por último.
async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    return await callClaude(systemPrompt, userPrompt);
  } catch (e) {
    console.error("CLAUDE_FALHOU (caindo no Cerebras):", String(e));
    try {
      return await callCerebras(systemPrompt, userPrompt);
    } catch (e2) {
      console.error("CEREBRAS_FALHOU (caindo no Gemini):", String(e2));
      return await callGemini(systemPrompt, userPrompt);
    }
  }
}

// Persona do mentor Vant para as dicas rápidas do DEFCON (dica do dia / dica da hora).
// Mesma alma do chat: específico, nunca genérico, linguagem de rua.
const ORBIS_COACH = `Você é o mentor de vendas da Vant, o app de vendedor de rua/ambulante no Brasil.
Fala como parça de corre: direto, linguagem da rua, firme e motivador, mas realista — sem papo corporativo.
REGRAS:
- SEMPRE específico, NUNCA genérico: use os números que te passarem.
- Dicas que dá pra aplicar JÁ: abordagem, oferta de kit/combo, fechamento, Pix na hora.
- Curto e seco. Sem markdown, sem asteriscos, sem títulos, sem emoji em excesso.
- Português do Brasil, tom de quem tá junto no corre.

REALIDADE DO VENDEDOR DE RUA (REGRA DE OURO — NUNCA QUEBRE):
- O ticket REAL dele é vendido ÷ vendas. ANCORE toda sugestão nesse número de verdade.
- Vendedor de rua vende BARATO e em VOLUME (ticket típico R$5 a R$50). É PROIBIDO inventar ticket fora da realidade dele: se ele vende a R$10, NUNCA mande "venda kits de R$200" — isso é fantasia e destrói a confiança no app.
- Pra crescer/bater meta o caminho é: MAIS ABORDAGENS (volume) + subir o ticket POUCO e realista (um combo que sai no MÁXIMO ~1,5x a 2x o ticket atual; ex: R$10 → R$20) + melhorar a conversão. NUNCA faça "meta ÷ 2 = vender 2 itens caríssimos".
- Estratégia SÓLIDA que cabe no MOMENTO ATUAL dele. Se um número não fecha com a realidade da rua, não sugere.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    custoUser = user.id;
    const hist = await historicoVendedor(supabase, user.id);

    // Trava de uso: teto de gerações de IA por dia (protege o gasto). Falha FECHADO.
    {
      const { data: usage, error: usageErr } = await supabase.rpc("bump_ai_usage", { p_feature: "insights", p_limit: 25 });
      if (usageErr) {
        return new Response(JSON.stringify({ error: "trava_indisponivel" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if ((usage as any)?.over) {
        const msg = "Você já usou bastante a IA hoje! 💪 Amanhã ela volta com tudo.";
        const t = body?.type;
        if (t === "defcon_day_report" || t === "defcon_block_report")
          return new Response(JSON.stringify({ tip: msg }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (t === "report_analysis")
          return new Response(JSON.stringify({ analise: msg }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (t === "financas_dica")
          return new Response(JSON.stringify({ titulo: "A IA já trabalhou bastante hoje", texto: msg, limite: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ message: msg }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Dica do dia — fim do DEFCON (botão "Gerar dica do dia com IA")
    if (body?.type === "defcon_day_report") {
      const conv = body.conversionRate ?? "0";
      const goalLine = body.goal
        ? `\n- Meta do dia: R$ ${Number(body.goal).toFixed(0)} | Vendido: R$ ${Number(body.sold ?? 0).toFixed(0)}`
        : "";
      const ticketDia = Number(body.sales ?? 0) > 0 ? Number(body.sold ?? 0) / Number(body.sales) : 0;
      const ticketLine = ticketDia > 0
        ? `\n- Ticket médio REAL: R$ ${ticketDia.toFixed(0)} (ANCORE nisso — é proibido sugerir ticket fora dessa realidade)`
        : "";
      const prompt = `Acabou o dia de corre do vendedor:
- Abordagens: ${body.approaches}
- Vendas: ${body.sales}
- Conversão: ${conv}%${goalLine}${ticketLine}
Dê no máximo 2 dicas curtas e práticas, ANCORADAS no ticket real dele, pra ele vender mais AMANHÃ (caminho real: mais abordagens + combo realista, NUNCA ticket de fantasia). Máximo 3 linhas no total. Compare com a média dele e diga se hoje foi acima ou abaixo do normal.${hist}`;
      const tip = await callAI(ORBIS_COACH, prompt);
      return new Response(JSON.stringify({ tip }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Dica da hora — fim de cada bloco do DEFCON (botão "Gerar dica da hora com IA")
    if (body?.type === "defcon_block_report") {
      const conv = body.conversionRate ?? "0";
      const hora = Number(body.blockIndex ?? 0) + 1;
      const prompt = `Acabou a ${hora}ª hora do corre do vendedor:
- Abordagens nessa hora: ${body.approaches}
- Vendas nessa hora: ${body.sales}
- Conversão: ${conv}%
- Vendido na hora: R$ ${Number(body.soldAmount ?? 0).toFixed(0)}
Dê 1 dica curta e afiada, baseada NESSES números, pra ele melhorar JÁ na PRÓXIMA hora. Máximo 2 linhas. Sem rodeio.${hist}`;
      const tip = await callAI(ORBIS_COACH, prompt);
      return new Response(JSON.stringify({ tip }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Análise do Relatório — IA de verdade (gastos + dia/semana/mês + melhorias + falhas)
    if (body?.type === "report_analysis") {
      const periodo = (body.periodo ?? "período").toString();
      const gastos = Array.isArray(body.gastos) ? body.gastos : [];
      const gastosLinhas = gastos.length
        ? gastos
            .map((g: { category?: string; total?: number; count?: number }) =>
              `  - ${g.category ?? "Outros"}: R$ ${Number(g.total ?? 0).toFixed(0)} (${g.count ?? 0} ${Number(g.count) === 1 ? "item" : "itens"})`)
            .join("\n")
        : "  - (sem gastos pessoais registrados no período)";
      const horas = Array.isArray(body.melhoresHorarios) ? body.melhoresHorarios : [];
      const horasLinha = horas.length
        ? horas.map((h: { label?: string; avg?: number }) => `${h.label ?? "?"} (R$ ${Number(h.avg ?? 0).toFixed(0)})`).join(", ")
        : "sem dados";

      const userPrompt = `Período analisado: ${periodo} (${body.rangeLabel ?? ""}).
NÚMEROS:
- Faturamento: R$ ${Number(body.faturamento ?? 0).toFixed(0)}
- Lucro líquido: R$ ${Number(body.lucro ?? 0).toFixed(0)}
- Vendas: ${body.totalVendas ?? 0} | Abordagens: ${body.totalAbordagens ?? 0} | Conversão: ${body.conversao ?? 0}%
- Abordagens por venda: ${body.abordagensPorVenda ?? 0} | Ticket médio: R$ ${Number(body.ticketMedio ?? 0).toFixed(0)}
- Média diária: R$ ${Number(body.mediaDiaria ?? 0).toFixed(0)} | Vs período anterior: ${body.comparePct ?? 0}%
CUSTOS:
- Mercadoria: R$ ${Number(body.custoMercadoria ?? 0).toFixed(0)} | Transporte+alimentação: R$ ${Number(body.custoOperacao ?? 0).toFixed(0)}
- Calotes: R$ ${Number(body.calotes ?? 0).toFixed(0)} (${body.caloteUnidades ?? 0} kits não pagos)
GASTOS PESSOAIS POR CATEGORIA (no que ele gasta o dinheiro):
${gastosLinhas}
Melhores horários: ${horasLinha}

Escreve uma análise curta e direta pro vendedor, em português de rua, ESPECÍFICA (cite os números acima). Use EXATAMENTE estas 5 seções, cada uma com o título em CAIXA ALTA seguido de dois pontos:

COMO TÁ SEU ${periodo.toUpperCase()}: 2-3 frases sobre faturamento, lucro e conversão.

PRA ONDE VAI O DINHEIRO: com o que ele mais gasta e se algo tá pesando demais. Se não houver gastos registrados, manda ele registrar pra enxergar pra onde vai o dinheiro.

PRA MELHORAR: 2 a 3 pontos práticos, um por linha começando com "- ".

PONTOS DE FALHA: 1 a 3 pontos onde ele perde dinheiro, venda ou tempo, um por linha começando com "- ".

FOCO AGORA: 1 frase direta.

Não use asteriscos, markdown nem outros títulos além desses cinco.${hist}`;

      // Texto puro (mesmo método da dica do dia). Cerebras primeiro, Gemini de reserva.
      const analise = await callAI(
        ORBIS_COACH + "\nVocê está analisando o relatório do vendedor. Texto puro, direto, sem markdown.",
        userPrompt,
      );
      return new Response(JSON.stringify({ analise }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Dica da Vant — tela Finanças (Rick, 10/09): uma dica por dia, com os números
    // de contas, guardar-por-dia e caixinhas da própria pessoa. Devolve {titulo, texto}.
    if (body?.type === "financas_dica") {
      const n = (v: unknown) => Number(v ?? 0).toFixed(0);
      const contas = Array.isArray(body.contas) ? body.contas : [];
      const caixinhas = Array.isArray(body.caixinhas) ? body.caixinhas : [];
      const contasLinhas = contas.length
        ? contas.slice(0, 8).map((c: { nome?: string; valor?: number; guardado?: number; diasAteVencer?: number | null; porDia?: number; vencida?: boolean; paga?: boolean }) =>
            `  - ${c.nome ?? "conta"}: R$ ${n(c.valor)} | guardado R$ ${n(c.guardado)} | ${c.paga ? "PAGA este mês" : c.vencida ? "VENCIDA" : c.diasAteVencer == null ? "sem data" : `vence em ${c.diasAteVencer} dias`} | precisa R$ ${n(c.porDia)}/dia`).join("\n")
        : "  - (nenhuma conta cadastrada)";
      const caixinhasLinhas = caixinhas.length
        ? caixinhas.slice(0, 6).map((g: { nome?: string; alvo?: number; tem?: number; porDia?: number }) =>
            `  - ${g.nome ?? "caixinha"}: R$ ${n(g.tem)} de R$ ${n(g.alvo)} | ritmo R$ ${n(g.porDia)}/dia`).join("\n")
        : "  - (nenhuma caixinha)";
      const userPrompt = `Situação financeira do vendedor HOJE (${body.hoje ?? ""}):
- Lucro líquido médio por dia de rua: R$ ${n(body.mediaDia)}
- Sobrou pra ele este mês: R$ ${n(body.sobrouMes)} (de R$ ${n(body.vendidoMes)} vendidos)
- Lucro de hoje: R$ ${n(body.lucroHoje)} | fiado hoje: R$ ${n(body.fiadoHoje)}
- Precisa guardar hoje (contas + caixinhas): R$ ${n(body.guardarHoje)} | já guardou hoje: R$ ${n(body.guardouHoje)}
- Dias seguidos guardando: ${body.sequencia ?? 0}
- Contas vencidas em aberto: R$ ${n(body.vencidasTotal)}
CONTAS A PAGAR:
${contasLinhas}
CAIXINHAS (objetivos):
${caixinhasLinhas}

Escreva UMA dica pra ele, específica, citando os números acima. Prioridade: conta vencida > conta que vence nos próximos 5 dias e ainda falta dinheiro > contas maiores que o lucro > caixinha. Se está tudo em dia, elogia e aponta o próximo passo concreto.
Responda SOMENTE em JSON: {"titulo": "uma frase de impacto, até 80 caracteres", "texto": "2 ou 3 frases, até 320 caracteres, sem markdown"}.${hist}`;
      const raw = await callAI(
        ORBIS_COACH + "\nAgora você é o mentor FINANCEIRO dele: contas primeiro, caixinha depois. Nunca sugira crédito/empréstimo. Responda só o JSON pedido.",
        userPrompt,
      );
      const { titulo, texto } = extrairDica(raw);
      return new Response(JSON.stringify({ titulo: titulo.slice(0, 120), texto: texto.slice(0, 500) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Buscar dados dos últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekStart = sevenDaysAgo.toISOString().split("T")[0];

    const { data: salesData } = await supabase
      .from("daily_sales")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", weekStart)
      .order("date", { ascending: false });

    if (!salesData || salesData.length === 0) {
      return new Response(
        JSON.stringify({ message: "Continue registrando suas transações para receber insights personalizados." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const totalIncome = salesData.reduce((s, d) => s + (d.total_profit || 0), 0);
    const totalExpenses = salesData.reduce((s, d) => s + (d.total_debt || 0), 0);
    const balance = totalIncome - totalExpenses;
    const daysWithSales = salesData.length;
    const avgDailyProfit = daysWithSales > 0 ? totalIncome / daysWithSales : 0;
    const todayProfit = salesData.filter(s => s.date === today).reduce((s, d) => s + (d.total_profit || 0), 0);

    const systemPrompt = `Você é a Vant IA, especialista em análise pra vendedor ambulante de RUA (vende barato e em VOLUME). Gere um relatório JSON com insights estratégicos REALISTAS pra rua — nada de ticket ou meta de fantasia; o caminho é volume (mais abordagens) + ticket realista (combo no máx ~1,5x-2x o atual) + conversão. Responda APENAS com o JSON, sem texto extra.`;

    const userPrompt = `Dados dos últimos 7 dias:
- Vendas totais: R$ ${totalIncome.toFixed(2)}
- Calotes: R$ ${totalExpenses.toFixed(2)}
- Lucro líquido: R$ ${balance.toFixed(2)}
- Média diária: R$ ${avgDailyProfit.toFixed(2)}
- Hoje: R$ ${todayProfit.toFixed(2)}
- Dias trabalhados: ${daysWithSales}${hist}

Retorne SOMENTE este JSON preenchido:
{
  "weeklyProjection": "projeção semanal em 2-3 frases",
  "goalEstimate": "estimativa de quando bate a meta em 1-2 frases",
  "last7DaysAnalysis": "análise dos últimos 7 dias em 3-4 frases",
  "productiveHours": "análise de horários produtivos em 2-3 frases",
  "improvement": "sugestão acionável em 2-3 frases"
}`;

    const aiText = await callAI(systemPrompt, userPrompt);

    let parsedReport;
    try {
      // extrai JSON mesmo se a IA envolver em ```json ... ```
      const match = aiText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("JSON não encontrado na resposta");
      parsedReport = JSON.parse(match[0]);
    } catch {
      throw new Error("Não foi possível processar a resposta da IA. Tente novamente.");
    }

    return new Response(
      JSON.stringify(parsedReport),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-insights:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
