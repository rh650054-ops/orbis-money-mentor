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

    const systemPrompt = `Você é o Orbis IA, um assistente financeiro especializado em vendas de rua e comércio ambulante.
Você entende profundamente os desafios únicos dos vendedores ambulantes: variação de movimento, pontos de venda, horários de pico, gestão de calotes, controle de estoque, clima e concorrência.

Analise os dados financeiros fornecidos e gere EXATAMENTE 4 insights estratégicos em formato JSON.
Estrutura obrigatória para cada insight:
{
  "type": "success" | "warning" | "info" | "goal",
  "title": "Título curto e impactante (máximo 6 palavras)",
  "description": "Uma frase prática e acionável sobre o que fazer",
  "impact": "Valor numérico ou porcentagem que quantifica o impacto"
}

Diretrizes:
- Seja EXTREMAMENTE prático e focado em ações específicas para vendedores de rua
- Use linguagem motivacional mas realista
- Identifique padrões de vendas (dias melhores, horários, formas de pagamento)
- Sugira estratégias concretas para aumentar lucro e reduzir calotes
- Celebre conquistas e incentive melhorias
- Quantifique sempre que possível (ex: "R$ 50 a mais", "15% de crescimento")

Retorne APENAS um JSON válido no formato: {"insights": [...]}`;

    const userPrompt = `Contexto: Vendedor ambulante registrando vendas diárias

Dados do período atual:
📊 Financeiro:
- Total de vendas no mês: R$ ${totalIncome.toFixed(2)}
- Total de calotes: R$ ${totalExpenses.toFixed(2)}
- Saldo líquido: R$ ${balance.toFixed(2)}
- Margem: ${totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : 0}%

📈 Atividade:
- Dias trabalhados: ${daysWithSales}
- Média de vendas por dia: R$ ${avgDailyProfit.toFixed(2)}
- Performance hoje: R$ ${todayProfit.toFixed(2)}

Com base nesses dados, gere 4 insights estratégicos focados em:
1. Reconhecimento de conquistas ou alerta sobre problemas
2. Oportunidade de crescimento identificada
3. Dica prática para melhorar resultados
4. Meta alcançável para os próximos dias

Lembre-se: vendedor ambulante precisa de insights que considere a realidade da rua (movimento, clima, ponto de venda, etc.)`;

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
      console.error("Request body:", JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt.substring(0, 100) + "..." },
          { role: "user", content: userPrompt.substring(0, 100) + "..." }
        ]
      }));
      throw new Error(`Erro ao conectar com IA: ${aiResponse.status}. Verifique a configuração do Lovable AI.`);
    }

    const aiData = await aiResponse.json();
    console.log("AI Response received:", JSON.stringify(aiData).substring(0, 200));
    
    const content = aiData.choices[0].message.content;
    let parsedInsights;
    
    try {
      const jsonData = JSON.parse(content);
      parsedInsights = jsonData.insights || jsonData;
      console.log("Parsed insights:", parsedInsights.length, "insights generated");
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      console.error("Parse error:", e);
      throw new Error("Não foi possível processar a resposta da IA. Tente novamente.");
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
