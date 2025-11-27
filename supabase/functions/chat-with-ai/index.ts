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

    // Get last user message
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      throw new Error("Nenhuma mensagem do usuário encontrada");
    }

    console.log("Enviando mensagem para n8n webhook...");
    console.log("Mensagem:", lastUserMessage.content);

    // Call n8n webhook (production URL)
    const webhookResponse = await fetch("https://jovemrick.app.n8n.cloud/webhook/orbis-vendedor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: lastUserMessage.content,
      }),
    });

    console.log("Status do webhook:", webhookResponse.status);
    console.log("Headers da resposta:", JSON.stringify(Object.fromEntries(webhookResponse.headers.entries())));

    if (!webhookResponse.ok) {
      // Tentar ler o corpo da resposta para ver o erro do n8n
      let errorBody = "";
      try {
        const contentType = webhookResponse.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const errorJson = await webhookResponse.json();
          errorBody = JSON.stringify(errorJson);
        } else {
          errorBody = await webhookResponse.text();
        }
      } catch (e) {
        errorBody = "Não foi possível ler o corpo da resposta";
      }
      
      console.error("Webhook error status:", webhookResponse.status);
      console.error("Webhook error body:", errorBody);
      console.error("URL chamada:", "https://jovemrick.app.n8n.cloud/webhook/orbis-vendedor");
      console.error("Body enviado:", JSON.stringify({ input: lastUserMessage.content }));
      
      throw new Error(`Webhook do n8n retornou erro ${webhookResponse.status}. Verifique os logs do workflow no n8n. Detalhes: ${errorBody.substring(0, 200)}`);
    }

    const webhookData = await webhookResponse.json();
    console.log("Resposta do webhook recebida:", JSON.stringify(webhookData).substring(0, 200));

    if (!webhookData.resposta) {
      console.error("Resposta inválida do webhook:", JSON.stringify(webhookData));
      throw new Error("Resposta do webhook não contém o campo 'resposta'");
    }

    const assistantMessage = webhookData.resposta;

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
