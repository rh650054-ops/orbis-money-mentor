import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Buscar dados dos últimos 7 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekStart = sevenDaysAgo.toISOString().split('T')[0];

    const { data: salesData } = await supabase
      .from("daily_sales")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", weekStart)
      .order("date", { ascending: false });

    if (!salesData || salesData.length === 0) {
      return new Response(
        JSON.stringify({ 
          insights: [],
          message: "Continue registrando suas transações para receber insights personalizados da IA."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Preparar dados para análise
    const today = new Date().toISOString().split('T')[0];
    const totalIncome = salesData.reduce((sum, day) => sum + (day.total_profit || 0), 0);
    const totalExpenses = salesData.reduce((sum, day) => sum + (day.total_debt || 0), 0);
    const balance = totalIncome - totalExpenses;
    const daysWithSales = salesData.length;
    const avgDailyProfit = daysWithSales > 0 ? totalIncome / daysWithSales : 0;

    // Dados de hoje
    const todaySales = salesData.filter(s => s.date === today);
    const todayProfit = todaySales.reduce((sum, s) => sum + (s.total_profit || 0), 0);

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `Você é o Orbis IA, especialista em análise financeira para vendedores ambulantes.
Analise os dados dos últimos 7 dias e gere um relatório com insights estratégicos.

Retorne um JSON com esta estrutura:
{
  "weeklyProjection": "Texto sobre projeção semanal baseada nos padrões identificados",
  "goalEstimate": "Estimativa de quando o usuário vai bater a meta com base no ritmo atual",
  "last7DaysAnalysis": "Análise detalhada dos últimos 7 dias com padrões e tendências",
  "productiveHours": "Análise dos horários mais produtivos (inferir pelos timestamps)",
  "improvement": "Sugestão específica e acionável para melhorar resultados"
}

Seja direto, prático e motivacional.`;

    const userPrompt = `Contexto: Vendedor ambulante com ${daysWithSales} dias registrados nos últimos 7 dias

Dados dos últimos 7 dias:
💰 Vendas totais: R$ ${totalIncome.toFixed(2)}
📉 Calotes: R$ ${totalExpenses.toFixed(2)}
✅ Lucro líquido: R$ ${balance.toFixed(2)}
📊 Média diária: R$ ${avgDailyProfit.toFixed(2)}
🎯 Hoje: R$ ${todayProfit.toFixed(2)}

Gere um relatório completo com os 5 campos solicitados.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", aiResponse.status);
      throw new Error(`Erro ao conectar com IA: ${aiResponse.status}. Verifique a configuração do Lovable AI.`);
    }

    const aiData = await aiResponse.json();
    console.log("AI Response received");
    
    const content = aiData.choices[0].message.content;
    let parsedReport;
    
    try {
      parsedReport = JSON.parse(content);
      console.log("Report generated successfully");
    } catch (e) {
      console.error("Failed to parse AI response");
      throw new Error("Não foi possível processar a resposta da IA. Tente novamente.");
    }

    return new Response(
      JSON.stringify(parsedReport),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-insights");
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
