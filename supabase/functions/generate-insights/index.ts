import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// ---- Claude (Anthropic, texto). Primeiro da fila; cai no Cerebras/Gemini se faltar chave/erro/credito. ----
async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("sem_anthropic_key");
  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`claude_${res.status}: ${errBody.slice(0, 250)}`);
  }
  const j = await res.json();
  const content = ((j?.content ?? []).map((b: any) => b?.text || "").join("")).trim();
  if (!content) throw new Error("claude_vazio");
  return content;
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

// Persona do mentor Orbis para as dicas rápidas do DEFCON (dica do dia / dica da hora).
// Mesma alma do chat: específico, nunca genérico, linguagem de rua.
const ORBIS_COACH = `Você é o mentor de vendas do Orbis, o app de vendedor de rua/ambulante no Brasil.
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
Dê no máximo 2 dicas curtas e práticas, ANCORADAS no ticket real dele, pra ele vender mais AMANHÃ (caminho real: mais abordagens + combo realista, NUNCA ticket de fantasia). Máximo 3 linhas no total.`;
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
Dê 1 dica curta e afiada, baseada NESSES números, pra ele melhorar JÁ na PRÓXIMA hora. Máximo 2 linhas. Sem rodeio.`;
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

Não use asteriscos, markdown nem outros títulos além desses cinco.`;

      // Texto puro (mesmo método da dica do dia). Cerebras primeiro, Gemini de reserva.
      const analise = await callAI(
        ORBIS_COACH + "\nVocê está analisando o relatório do vendedor. Texto puro, direto, sem markdown.",
        userPrompt,
      );
      return new Response(JSON.stringify({ analise }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const systemPrompt = `Você é o Orbis IA, especialista em análise pra vendedor ambulante de RUA (vende barato e em VOLUME). Gere um relatório JSON com insights estratégicos REALISTAS pra rua — nada de ticket ou meta de fantasia; o caminho é volume (mais abordagens) + ticket realista (combo no máx ~1,5x-2x o atual) + conversão. Responda APENAS com o JSON, sem texto extra.`;

    const userPrompt = `Dados dos últimos 7 dias:
- Vendas totais: R$ ${totalIncome.toFixed(2)}
- Calotes: R$ ${totalExpenses.toFixed(2)}
- Lucro líquido: R$ ${balance.toFixed(2)}
- Média diária: R$ ${avgDailyProfit.toFixed(2)}
- Hoje: R$ ${todayProfit.toFixed(2)}
- Dias trabalhados: ${daysWithSales}

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
