import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@18.5.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2024-11-20.acacia",
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );

    console.log(`[WEBHOOK] Evento recebido: ${event.type}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Processar eventos de pagamento
    switch (event.type) {
      case "invoice.payment_succeeded":
      case "payment_intent.succeeded": {
        const object = event.data.object as any;
        const customerId = object.customer;
        const userId = object.metadata?.user_id;

        console.log(`[WEBHOOK] Pagamento bem-sucedido para customer: ${customerId}`);

        if (userId) {
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              plan_status: "active",
              is_trial_active: false,
            })
            .eq("user_id", userId);

          if (error) {
            console.error("[WEBHOOK] Erro ao atualizar perfil:", error);
          } else {
            console.log(`[WEBHOOK] Perfil atualizado para user: ${userId}`);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        const status = subscription.status;
        const userId = subscription.metadata?.user_id;

        console.log(`[WEBHOOK] Subscription ${status} para customer: ${customerId}`);

        if (userId && status === "active") {
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              plan_status: "active",
              is_trial_active: false,
            })
            .eq("user_id", userId);

          if (error) {
            console.error("[WEBHOOK] Erro ao atualizar perfil:", error);
          } else {
            console.log(`[WEBHOOK] Perfil atualizado para user: ${userId}`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const userId = subscription.metadata?.user_id;

        if (userId) {
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              plan_status: "expired",
              is_trial_active: false,
            })
            .eq("user_id", userId);

          if (error) {
            console.error("[WEBHOOK] Erro ao atualizar perfil:", error);
          } else {
            console.log(`[WEBHOOK] Subscription cancelada para user: ${userId}`);
          }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[WEBHOOK] Erro:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 400 }
    );
  }
});
