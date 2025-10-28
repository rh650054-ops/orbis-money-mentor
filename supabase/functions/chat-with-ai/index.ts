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

    const { messages } = await req.json();
    
    // Validate messages array
    if (!messages || !Array.isArray(messages)) {
      throw new Error("Invalid messages format");
    }

    // Validate array length
    if (messages.length === 0 || messages.length > 50) {
      throw new Error("Messages array must contain between 1 and 50 messages");
    }

    // Validate each message
    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') {
        throw new Error("Invalid message format");
      }
      
      if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
        throw new Error("Invalid message role");
      }
      
      if (!msg.content || typeof msg.content !== 'string') {
        throw new Error("Invalid message content");
      }
      
      if (msg.content.length === 0 || msg.content.length > 4000) {
        throw new Error("Message content must be between 1 and 4000 characters");
      }
    }

    console.log("Processing chat request");
    console.log("Messages count:", messages.length);

    // Buscar dados do usuário para contexto
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

    const { data: routineData } = await supabase
      .from("routines")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Preparar contexto do usuário
    let userContext = "";
    if (salesData && salesData.length > 0) {
      const totalIncome = salesData.reduce((sum, day) => sum + (day.total_profit || 0), 0);
      const totalExpenses = salesData.reduce((sum, day) => sum + (day.total_debt || 0), 0);
      const balance = totalIncome - totalExpenses;
      
      userContext = `\n\nContexto financeiro do usuário:
- Total de vendas no mês: R$ ${totalIncome.toFixed(2)}
- Total de calotes: R$ ${totalExpenses.toFixed(2)}
- Saldo líquido: R$ ${balance.toFixed(2)}
- Dias trabalhados: ${salesData.length}`;
    }

    if (routineData) {
      userContext += `\n\nRotina do usuário:
- Acordar: ${routineData.wake_time}
- Trabalho: ${routineData.work_start} - ${routineData.work_end}
- Meta diária: R$ ${routineData.daily_profit || 0}`;
    }

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `Você é o Orbis, um assistente financeiro especializado em vendedores ambulantes e comércio de rua.

PERSONALIDADE:
- Amigável, motivador e prático
- Usa linguagem simples e direta
- Entende os desafios únicos de quem trabalha na rua
- Celebra conquistas e oferece soluções concretas

EXPERTISE:
- Gestão financeira para vendedores ambulantes
- Estratégias de vendas e pontos de venda
- Controle de calotes e crédito
- Análise de horários de pico
- Planejamento de rotina e metas
- Motivação e desenvolvimento pessoal${userContext}

DIRETRIZES:
- Seja sempre positivo mas realista
- Dê conselhos práticos e acionáveis
- Use exemplos do dia a dia de vendedor de rua
- Quando falar de dinheiro, use valores realistas para o contexto brasileiro
- Responda de forma concisa (máximo 3-4 parágrafos)
- Use emojis ocasionalmente para ser mais amigável 😊`;

    console.log("Calling Lovable AI...");

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
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 500
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", aiResponse.status);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "Muitas requisições. Por favor, aguarde um momento e tente novamente." 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "Limite de uso da IA atingido. Entre em contato com o suporte." 
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Erro na API da IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const assistantMessage = aiData.choices[0].message.content;

    console.log("AI response received successfully");

    return new Response(
      JSON.stringify({ 
        message: assistantMessage,
        success: true
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in chat-with-ai");
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
