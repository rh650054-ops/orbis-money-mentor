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
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(jsonMode ? 30000 : 20000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: jsonMode ? 2048 : 1024,
          // Força a IA a devolver JSON válido (evita JSON.parse quebrar com texto livre)
          ...(jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    throw new Error(`Erro na IA (${res.status}): ${err.substring(0, 200)}`);
  }

  const json = await res.json();
  const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Resposta inválida da IA.");
  return content;
}

// Persona do mentor Orbis para as dicas rápidas do DEFCON (dica do dia / dica da hora).
// Mesma alma do chat: específico, nunca genérico, linguagem de rua.
const ORBIS_COACH = `Você é o mentor de vendas do Orbis, o app de vendedor de rua/ambulante no Brasil.
Fala como parça de corre: direto, linguagem da rua, firme e motivador, mas realista — sem papo corporativo.
REGRAS:
- SEMPRE específico, NUNCA genérico: use os números que te passarem.
- Dicas que dá pra aplicar JÁ: abordagem, oferta de kit/combo, fechamento, Pix na hora.
- Curto e seco. Sem markdown, sem asteriscos, sem títulos, sem emoji em excesso.
- Português do Brasil, tom de quem tá junto no corre.`;

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
      const prompt = `Acabou o dia de corre do vendedor:
- Abordagens: ${body.approaches}
- Vendas: ${body.sales}
- Conversão: ${conv}%${goalLine}
Dê no máximo 2 dicas curtas e práticas, baseadas NESSES números, pra ele vender mais AMANHÃ. Máximo 3 linhas no total.`;
      const tip = await callGemini(ORBIS_COACH, prompt);
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
      const tip = await callGemini(ORBIS_COACH, prompt);
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

Analise e devolva SOMENTE este JSON preenchido, em português de rua, ESPECÍFICO (cite os números acima), sem markdown:
{
  "diagnostico": "como está o ${periodo} até agora, em 2-3 frases, citando faturamento, lucro e conversão",
  "gastos": "com o que ele mais gasta e se algum gasto está pesando demais no bolso, em 2-3 frases. Se não houver gastos registrados, oriente a registrar pra enxergar pra onde vai o dinheiro",
  "melhorias": ["2 a 3 melhorias práticas e específicas pra ele vender ou lucrar mais"],
  "falhas": ["1 a 3 principais pontos de falha — onde ele está perdendo dinheiro, venda ou tempo"],
  "foco": "a principal coisa pra focar agora, em 1 frase direta"
}`;

      const aiText = await callGemini(
        ORBIS_COACH + "\nVocê está analisando o relatório do vendedor. Responda APENAS com o JSON pedido, sem texto fora dele.",
        userPrompt,
        true, // modo JSON — garante JSON válido
      );
      let parsed;
      try {
        const match = aiText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("JSON não encontrado");
        parsed = JSON.parse(match[0]);
      } catch {
        throw new Error("Não consegui montar a análise agora. Tenta de novo em instantes.");
      }
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const systemPrompt = `Você é o Orbis IA, especialista em análise financeira para vendedores ambulantes. Analise os dados e gere um relatório JSON com insights estratégicos. Responda APENAS com o JSON, sem texto extra.`;

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

    const aiText = await callGemini(systemPrompt, userPrompt);

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
