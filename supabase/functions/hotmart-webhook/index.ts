import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Hotmart hottok
    const hottok = req.headers.get("x-hotmart-hottok");
    const expectedHottok = Deno.env.get("HOTMART_HOTTOK");

    if (expectedHottok && hottok !== expectedHottok) {
      console.error("Invalid hottok");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const payload = await req.json();
    console.log("Hotmart event received:", JSON.stringify(payload).slice(0, 500));

    const event = payload.event || payload.data?.event;
    const buyerEmail = payload.data?.buyer?.email || payload.buyer?.email;
    const buyerDoc = payload.data?.buyer?.document || payload.buyer?.document;
    const purchaseId = payload.data?.purchase?.transaction || payload.purchase?.transaction || "";
    const subscriptionId = payload.data?.subscription?.subscriber?.code || "";

    // Clean CPF (remove non-digits)
    const buyerCpf = buyerDoc ? buyerDoc.replace(/\D/g, "") : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user by CPF first, then email fallback
    let userId: string | null = null;

    if (buyerCpf) {
      const { data: profileByCpf } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("cpf", buyerCpf)
        .maybeSingle();
      if (profileByCpf) userId = profileByCpf.user_id;
    }

    if (!userId && buyerEmail) {
      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", buyerEmail)
        .maybeSingle();
      if (profileByEmail) userId = profileByEmail.user_id;
    }

    // If can't identify user, store as unlinked
    if (!userId) {
      console.log("Could not identify user, storing as unlinked purchase");
      await supabase.from("unlinked_purchases").insert({
        buyer_email: buyerEmail || null,
        buyer_cpf: buyerCpf || null,
        hotmart_purchase_id: purchaseId,
        hotmart_subscription_id: subscriptionId,
        event_type: event,
        payload,
      });
      return new Response(JSON.stringify({ status: "unlinked" }), {
        headers: corsHeaders,
      });
    }

    // Calculate period end (30 days from now as default for monthly)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + 30);
    const graceEnd = new Date(periodEnd);
    graceEnd.setDate(graceEnd.getDate() + 3);

    // Handle events
    const eventNormalized = (event || "").toUpperCase();

    if (
      eventNormalized.includes("PURCHASE_APPROVED") ||
      eventNormalized.includes("PURCHASE_COMPLETE") ||
      eventNormalized.includes("SUBSCRIPTION_RENEWAL")
    ) {
      // Activate subscription
      await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            provider: "hotmart",
            status: "active",
            current_period_end: periodEnd.toISOString(),
            grace_until: graceEnd.toISOString(),
            hotmart_purchase_id: purchaseId,
            hotmart_subscription_id: subscriptionId,
            last_event_at: now.toISOString(),
          },
          { onConflict: "user_id" }
        );

      // Update profile plan_status
      await supabase
        .from("profiles")
        .update({ plan_status: "active", is_trial_active: false })
        .eq("user_id", userId);

      console.log(`Subscription activated for user ${userId}`);
    } else if (
      eventNormalized.includes("PURCHASE_DELAYED") ||
      eventNormalized.includes("PURCHASE_PROTEST")
    ) {
      // Past due
      await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            provider: "hotmart",
            status: "past_due",
            hotmart_purchase_id: purchaseId,
            hotmart_subscription_id: subscriptionId,
            last_event_at: now.toISOString(),
          },
          { onConflict: "user_id" }
        );

      console.log(`Subscription past_due for user ${userId}`);
    } else if (
      eventNormalized.includes("SUBSCRIPTION_CANCELLATION") ||
      eventNormalized.includes("PURCHASE_REFUNDED") ||
      eventNormalized.includes("PURCHASE_CHARGEBACK")
    ) {
      // Cancel immediately
      await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            provider: "hotmart",
            status: "canceled",
            grace_until: now.toISOString(), // Block immediately
            hotmart_purchase_id: purchaseId,
            hotmart_subscription_id: subscriptionId,
            last_event_at: now.toISOString(),
          },
          { onConflict: "user_id" }
        );

      await supabase
        .from("profiles")
        .update({ plan_status: "expired" })
        .eq("user_id", userId);

      console.log(`Subscription canceled for user ${userId}`);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
