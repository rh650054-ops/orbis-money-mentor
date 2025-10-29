import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    
    if (!signature) {
      console.error("No stripe signature found");
      return new Response("No signature", { status: 400, headers: corsHeaders });
    }

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 400, headers: corsHeaders });
    }

    console.log("Processing webhook event:", event.type);

    // Handle successful checkout
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerEmail = session.customer_email;

      if (!customerEmail) {
        console.error("No customer email in session");
        return new Response("No customer email", { status: 400, headers: corsHeaders });
      }

      console.log("Activating subscription for:", customerEmail);

      // Calculate next payment date (30 days from now)
      const today = new Date();
      const nextPaymentDate = new Date(today);
      nextPaymentDate.setDate(today.getDate() + 30);

      // Update user's subscription status
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          plan_type: "visionario",
          payment_status: "paid",
          is_trial_active: false,
          plan_status: "active",
          last_payment_date: today.toISOString().split("T")[0],
          next_payment_date: nextPaymentDate.toISOString().split("T")[0],
          subscription_id: session.subscription as string,
        })
        .eq("email", customerEmail);

      if (updateError) {
        console.error("Error updating user subscription:", updateError);
        return new Response("Database update failed", { 
          status: 500, 
          headers: corsHeaders 
        });
      }

      console.log("Successfully activated subscription for:", customerEmail);
    }

    // Handle subscription renewal
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      if (subscriptionId) {
        const today = new Date();
        const nextPaymentDate = new Date(today);
        nextPaymentDate.setDate(today.getDate() + 30);

        const { error: renewError } = await supabase
          .from("profiles")
          .update({
            payment_status: "paid",
            plan_status: "active",
            last_payment_date: today.toISOString().split("T")[0],
            next_payment_date: nextPaymentDate.toISOString().split("T")[0],
          })
          .eq("subscription_id", subscriptionId);

        if (renewError) {
          console.error("Error renewing subscription:", renewError);
        } else {
          console.log("Successfully renewed subscription:", subscriptionId);
        }
      }
    }

    // Handle failed payment
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      if (subscriptionId) {
        const { error: failError } = await supabase
          .from("profiles")
          .update({
            payment_status: "failed",
            plan_status: "expired",
          })
          .eq("subscription_id", subscriptionId);

        if (failError) {
          console.error("Error marking payment as failed:", failError);
        } else {
          console.log("Marked payment as failed for subscription:", subscriptionId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
