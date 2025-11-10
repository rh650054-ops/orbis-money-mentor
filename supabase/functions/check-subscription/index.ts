import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    console.log("[CHECK-SUBSCRIPTION] Iniciando");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Chave Stripe não configurada");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sem autorização");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Erro de autenticação: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("Usuário não autenticado");

    console.log("[CHECK-SUBSCRIPTION] Verificando:", user.email);

    // Buscar cliente Stripe
    const customersResponse = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=1`,
      {
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
        },
      }
    );

    const customersData = await customersResponse.json();
    
    if (!customersData.data || customersData.data.length === 0) {
      console.log("[CHECK-SUBSCRIPTION] Cliente não encontrado");
      
      await supabaseClient
        .from("profiles")
        .update({
          plan_status: "trial",
          payment_status: "pending",
          subscription_id: null,
        })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customersData.data[0].id;
    console.log("[CHECK-SUBSCRIPTION] Cliente encontrado:", customerId);

    // Buscar assinaturas ativas
    const subscriptionsResponse = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active&limit=1`,
      {
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
        },
      }
    );

    const subscriptionsData = await subscriptionsResponse.json();
    const hasActiveSub = subscriptionsData.data && subscriptionsData.data.length > 0;
    
    let subscriptionEnd = null;
    let subscriptionId = null;

    if (hasActiveSub) {
      const subscription = subscriptionsData.data[0];
      subscriptionId = subscription.id;
      
      // Validar se current_period_end existe antes de converter
      if (subscription.current_period_end) {
        subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      }
      
      console.log("[CHECK-SUBSCRIPTION] Assinatura ativa:", subscriptionId, "Fim:", subscriptionEnd);

      await supabaseClient
        .from("profiles")
        .update({
          plan_status: "active",
          plan_type: "pro",
          payment_status: "paid",
          subscription_id: subscriptionId,
          next_payment_date: subscriptionEnd,
          is_trial_active: false,
        })
        .eq("user_id", user.id);
    } else {
      console.log("[CHECK-SUBSCRIPTION] Sem assinatura ativa");
      
      await supabaseClient
        .from("profiles")
        .update({
          plan_status: "expired",
          payment_status: "pending",
          subscription_id: null,
        })
        .eq("user_id", user.id);
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_end: subscriptionEnd,
      subscription_id: subscriptionId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[CHECK-SUBSCRIPTION] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
