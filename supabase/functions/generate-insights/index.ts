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

    // Buscar dados do usuário
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    const monthStart = firstDayOfMonth.toISOString().split('T')[0];

    const { data: salesData } = await supabase
      .from("daily_sales")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", monthStart)
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

    const systemPrompt = `Você é o Orbis IA, assistente financeiro inteligente para vendedores ambulantes. 
Analise os dados financeiros e gere EXATAMENTE 4 insights no formato JSON array.
Cada insight deve ter: type (success/warning/info/goal), title (curto), description (1 frase), impact (número ou porcentagem).
Seja motivacional, prático e direto. Foque em ações concretas.`;

    const userPrompt = `Dados do mês:
- Total de vendas: R$ ${totalIncome.toFixed(2)}
- Total de calotes: R$ ${totalExpenses.toFixed(2)}
- Saldo: R$ ${balance.toFixed(2)}
- Dias com vendas: ${daysWithSales}
- Média diária: R$ ${avgDailyProfit.toFixed(2)}
- Vendas hoje: R$ ${todayProfit.toFixed(2)}

Gere 4 insights práticos e motivacionais.`;

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
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    let parsedInsights;
    
    try {
      const jsonData = JSON.parse(content);
      parsedInsights = jsonData.insights || jsonData;
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response");
    }

    return new Response(
      JSON.stringify({ insights: parsedInsights }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-insights:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
