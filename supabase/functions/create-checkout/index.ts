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

    // Criar sessão de checkout
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const sessionParams = new URLSearchParams({
      "success_url": `${origin}/`,
      "cancel_url": `${origin}/payment`,
      "mode": "subscription",
      "line_items[0][price]": "price_1SONeBItCFwr7saGhtz5gdcK",
      "line_items[0][quantity]": "1",
      [`metadata[user_id]`]: user.id,
    });

    if (customerId) {
      sessionParams.append("customer", customerId);
    } else {
      sessionParams.append("customer_email", user.email);
    }

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
    
    if (!sessionResponse.ok) {
      console.error("[CREATE-CHECKOUT] Erro Stripe:", sessionData);
      throw new Error(sessionData.error?.message || "Erro ao criar sessão");
    }

    console.log("[CREATE-CHECKOUT] Sessão criada:", sessionData.id);

    return new Response(JSON.stringify({ url: sessionData.url }), {
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
