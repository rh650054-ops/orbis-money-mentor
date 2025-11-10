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
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    console.log("[CREATE-CHECKOUT] Iniciando");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sem autorização");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Usuário não autenticado");

    console.log("[CREATE-CHECKOUT] Usuário:", user.email);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Chave Stripe não configurada");

    // Buscar cliente Stripe existente
    const customersResponse = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(user.email)}&limit=1`,
      {
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
        },
      }
    );

    const customersData = await customersResponse.json();
    let customerId = customersData.data?.[0]?.id;

    console.log("[CREATE-CHECKOUT] Cliente:", customerId || "novo");

    // Criar ou obter cliente
    if (!customerId) {
      const createCustomerResponse = await fetch(
        "https://api.stripe.com/v1/customers",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            email: user.email,
            metadata: JSON.stringify({ user_id: user.id }),
          }).toString(),
        }
      );

      const customerData = await createCustomerResponse.json();
      if (!createCustomerResponse.ok) {
        throw new Error(customerData.error?.message || "Erro ao criar cliente");
      }
      customerId = customerData.id;
      console.log("[CREATE-CHECKOUT] Cliente criado:", customerId);
    }

    // Criar subscription com payment behavior
    const subscriptionParams = new URLSearchParams({
      customer: customerId,
      "items[0][price]": "price_1SRiSkIvhIBqpwmQ15t3S6wk",
      "payment_behavior": "default_incomplete",
      "payment_settings[payment_method_types][]": "card",
      "expand[]": "latest_invoice.payment_intent",
      [`metadata[user_id]`]: user.id,
    });

    const subscriptionResponse = await fetch(
      "https://api.stripe.com/v1/subscriptions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: subscriptionParams.toString(),
      }
    );

    const subscriptionData = await subscriptionResponse.json();
    
    if (!subscriptionResponse.ok) {
      console.error("[CREATE-CHECKOUT] Erro Stripe:", subscriptionData);
      throw new Error(subscriptionData.error?.message || "Erro ao criar subscription");
    }

    console.log("[CREATE-CHECKOUT] Subscription criada:", subscriptionData.id);

    // Extrair client_secret do payment_intent
    const clientSecret = subscriptionData.latest_invoice?.payment_intent?.client_secret;
    
    if (!clientSecret) {
      throw new Error("Client secret não encontrado");
    }

    // Criar também uma sessão de checkout como fallback
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const sessionParams = new URLSearchParams({
      "success_url": `${origin}/`,
      "cancel_url": `${origin}/payment`,
      "mode": "subscription",
      "line_items[0][price]": "price_1SRiSkIvhIBqpwmQ15t3S6wk",
      "line_items[0][quantity]": "1",
      customer: customerId,
      [`metadata[user_id]`]: user.id,
    });

    const sessionResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: sessionParams.toString(),
      }
    );

    const sessionData = await sessionResponse.json();
    const paymentLink = sessionData.url || null;

    return new Response(JSON.stringify({ 
      clientSecret,
      paymentLink,
      customerId,
      subscriptionId: subscriptionData.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[CREATE-CHECKOUT] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
