import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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
    if (!authHeader) {
      console.error("[CREATE-CHECKOUT] Header Authorization ausente");
      throw new Error("Sem autorização");
    }

    console.log("[CREATE-CHECKOUT] Token recebido:", authHeader.substring(0, 20) + "...");

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError) {
      console.error("[CREATE-CHECKOUT] Erro na validação do token:", authError);
      throw new Error(`Falha na autenticação: ${authError.message}`);
    }
    
    const user = data.user;
    if (!user?.email) {
      console.error("[CREATE-CHECKOUT] Usuário sem email:", JSON.stringify(data));
      throw new Error("Usuário não autenticado ou email ausente");
    }

    console.log("[CREATE-CHECKOUT] Usuário:", user.email);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Chave Stripe não configurada");

    // Inicializar Stripe SDK
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });

    // Buscar ou criar cliente
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("[CREATE-CHECKOUT] Cliente existente:", customerId);
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      console.log("[CREATE-CHECKOUT] Cliente criado:", customerId);
    }

    // Criar subscription com expand correto
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: "price_1STN7LItCFwr7saGu341zn1Q" }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["card"],
      },
      expand: ["latest_invoice.payment_intent"],
      metadata: { user_id: user.id },
    });

    console.log("[CREATE-CHECKOUT] Subscription criada:", subscription.id);

    // Extrair client_secret com fallback robusto
    let clientSecret: string | null = null;

    // Tentar pegar do expand primeiro
    const latestInvoice = subscription.latest_invoice;
    if (latestInvoice && typeof latestInvoice !== 'string') {
      const paymentIntent = latestInvoice.payment_intent;
      if (paymentIntent && typeof paymentIntent !== 'string') {
        clientSecret = paymentIntent.client_secret;
      }
    }

    // Se não conseguiu pelo expand, buscar manualmente
    if (!clientSecret) {
      console.log("[CREATE-CHECKOUT] Expand falhou, buscando invoice manualmente");
      const invoiceId = typeof latestInvoice === 'string' ? latestInvoice : latestInvoice?.id;
      
      if (invoiceId) {
        const invoice = await stripe.invoices.retrieve(invoiceId, {
          expand: ["payment_intent"],
        });
        
        const pi = invoice.payment_intent;
        if (pi && typeof pi !== 'string') {
          clientSecret = pi.client_secret;
        }
      }
    }

    if (!clientSecret) {
      console.error("[CREATE-CHECKOUT] Não foi possível obter client_secret");
      throw new Error("Não foi possível inicializar o pagamento. Tente novamente.");
    }

    console.log("[CREATE-CHECKOUT] Client secret extraído com sucesso");

    // Criar checkout session como fallback
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: "price_1STN7LItCFwr7saGu341zn1Q", quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/`,
      cancel_url: `${origin}/payment`,
      metadata: { user_id: user.id },
    });

    const paymentLink = checkoutSession.url;

    return new Response(JSON.stringify({ 
      clientSecret,
      paymentLink,
      customerId,
      subscriptionId: subscription.id
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
