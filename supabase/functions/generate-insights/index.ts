import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callAnthropic(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    throw new Error(`Erro na IA (${res.status}): ${err.substring(0, 200)}`);
  }

  const json = await res.json();
  const content = json.content?.[0]?.text;
  if (!content) throw new Error("Resposta inválida da IA.");
  return content;
}

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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não está configurada no backend.");

    const body = await req.json();

    // Dica rápida para relatório do dia Defcon
    if (body?.type === "defcon_day_report") {
      const prompt = `O vendedor fez ${body.approaches} abordagens e ${body.sales} vendas hoje, taxa de ${body.conversionRate}%. Dê 2 dicas curtas e práticas para melhorar amanhã. Máximo 3 linhas.`;
      const tip = await callAnthropic(
        ANTHROPIC_API_KEY,
        "Você é um coach de vendas ambulantes. Seja direto e prático.",
        prompt
      );
      return new Response(JSON.stringify({ tip }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const aiText = await callAnthropic(ANTHROPIC_API_KEY, systemPrompt, userPrompt);

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
