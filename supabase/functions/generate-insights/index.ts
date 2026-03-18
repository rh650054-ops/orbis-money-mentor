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

    const body = await req.json();

    // Handle DEFCON day report AI tip
    if (body?.type === "defcon_day_report") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const prompt = `O vendedor ambulante fez ${body.approaches} abordagens e ${body.sales} vendas hoje, taxa de ${body.conversionRate}%. Dê 2 dicas curtas e práticas em linguagem simples para melhorar amanhã. Máximo 3 linhas.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um coach de vendas ambulantes. Seja direto e prático." },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!aiRes.ok) {
        if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI error");
      }

      const aiData = await aiRes.json();
      const tip = aiData.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ tip }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
Seja direto, prático e motivacional.`;

    const userPrompt = `Contexto: Vendedor ambulante com ${daysWithSales} dias registrados nos últimos 7 dias

Dados dos últimos 7 dias:
💰 Vendas totais: R$ ${totalIncome.toFixed(2)}
📉 Calotes: R$ ${totalExpenses.toFixed(2)}
✅ Lucro líquido: R$ ${balance.toFixed(2)}
📊 Média diária: R$ ${avgDailyProfit.toFixed(2)}
🎯 Hoje: R$ ${todayProfit.toFixed(2)}

Analise esses dados e gere insights acionáveis.`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "generate_insights_report",
              description: "Gera relatório de insights financeiros para vendedor ambulante",
              parameters: {
                type: "object",
                properties: {
                  weeklyProjection: {
                    type: "string",
                    description: "Projeção semanal baseada nos padrões identificados (2-3 frases)"
                  },
                  goalEstimate: {
                    type: "string",
                    description: "Estimativa de quando vai bater a meta com base no ritmo atual (1-2 frases)"
                  },
                  last7DaysAnalysis: {
                    type: "string",
                    description: "Análise detalhada dos últimos 7 dias com padrões e tendências (3-4 frases)"
                  },
                  productiveHours: {
                    type: "string",
                    description: "Análise dos horários mais produtivos e sugestões de timing (2-3 frases)"
                  },
                  improvement: {
                    type: "string",
                    description: "Sugestão específica e acionável para melhorar resultados (2-3 frases)"
                  }
                },
                required: ["weeklyProjection", "goalEstimate", "last7DaysAnalysis", "productiveHours", "improvement"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_insights_report" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("Limite de requisições atingido. Aguarde alguns instantes e tente novamente.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage.");
      }
      
      throw new Error(`Erro ao conectar com IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log("AI Response received:", JSON.stringify(aiData));
    
    let parsedReport;
    
    try {
      // Extract from tool call response
      const toolCall = aiData.choices[0].message.tool_calls?.[0];
      if (toolCall && toolCall.function.arguments) {
        parsedReport = JSON.parse(toolCall.function.arguments);
        console.log("Report generated successfully via tool call");
      } else {
        throw new Error("No tool call in AI response");
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      console.error("AI response:", JSON.stringify(aiData));
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
