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

    let assistantMessage = "";

    try {
      // Call n8n webhook - URL de produção
      const N8N_WEBHOOK_URL = "https://jovemrick.app.n8n.cloud/webhook/orbis-vendedor";
      console.log("Chamando webhook:", N8N_WEBHOOK_URL);
      
      const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
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
        console.error("URL chamada:", "https://jovemrick.app.n8n.cloud/webhook-test/orbis-vendedor");
        console.error("Body enviado:", JSON.stringify({ input: lastUserMessage.content }));
        
        throw new Error(`Webhook do n8n retornou erro ${webhookResponse.status}. Detalhes: ${errorBody.substring(0, 200)}`);
      }

      // Verificar se há conteúdo na resposta
      const responseText = await webhookResponse.text();
      console.log("Response text length:", responseText.length);
      console.log("Response text (first 200 chars):", responseText.substring(0, 200));
      
      if (!responseText || responseText.trim() === '') {
        console.error("Webhook retornou resposta vazia!");
        throw new Error("Resposta vazia do webhook do n8n");
      }

      let webhookData;
      try {
        webhookData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Erro ao fazer parse do JSON:", parseError);
        console.error("Response text:", responseText);
        throw new Error("O webhook retornou uma resposta inválida (não é JSON válido)");
      }

      console.log("Resposta do webhook recebida:", JSON.stringify(webhookData).substring(0, 200));

      if (!webhookData.resposta) {
        console.error("Resposta inválida do webhook:", JSON.stringify(webhookData));
        throw new Error("Resposta do webhook não contém o campo 'resposta'. Certifique-se de que o nó 'Respond to Webhook' no n8n está retornando {\"resposta\": \"texto da IA\"}");
      }

      assistantMessage = webhookData.resposta;
      console.log("AI response received successfully from n8n");
    } catch (webhookError) {
      console.error("Erro ao chamar webhook do n8n, usando fallback de IA nativa:", webhookError);

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        throw new Error("LOVABLE_API_KEY não está configurada no backend");
      }

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Você é o Orbis, um assistente financeiro e de produtividade para vendedores autônomos brasileiros. Responda sempre em português do Brasil, com tom motivador, direto e prático. Use exemplos de vendas do dia a dia, ajude a bater metas e melhorar constância.",
            },
            {
              role: "system",
              content:
                userContext
                  ? `Dados recentes do usuário para contexto:\n${userContext}\nUse esses dados para personalizar os conselhos e a motivação.`
                  : "Sem dados financeiros recentes disponíveis. Dê conselhos gerais de vendas, disciplina e constância.",
            },
            ...messages,
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("Erro na Lovable AI:", aiResponse.status, errorText);

        if (aiResponse.status === 429) {
          throw new Error("Limite de uso da IA excedido. Tente novamente em alguns minutos.");
        }
        if (aiResponse.status === 402) {
          throw new Error("Créditos de IA esgotados. Adicione créditos ao seu workspace do Lovable.");
        }

        throw new Error("Erro ao gerar resposta da IA de fallback");
      }

      const aiJson = await aiResponse.json();
      const content = aiJson.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        console.error("Resposta inesperada da Lovable AI:", JSON.stringify(aiJson).substring(0, 200));
        throw new Error("A IA de fallback retornou uma resposta inválida");
      }

      assistantMessage = content;
      console.log("AI response received successfully from Lovable AI fallback");
    }

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
