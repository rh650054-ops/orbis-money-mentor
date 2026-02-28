import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    // Find subscriptions past grace period
    const { data: expired, error } = await supabase
      .from("subscriptions")
      .select("id, user_id")
      .in("status", ["active", "past_due"])
      .lt("grace_until", now);

    if (error) throw error;

    let expiredCount = 0;
    for (const sub of expired || []) {
      await supabase
        .from("subscriptions")
        .update({ status: "inactive" })
        .eq("id", sub.id);

      await supabase
        .from("profiles")
        .update({ plan_status: "expired" })
        .eq("user_id", sub.user_id);

      expiredCount++;
    }

    // Also expire trials
    const { data: expiredTrials } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("is_trial_active", true)
      .lt("trial_end", now.split("T")[0]);

    for (const profile of expiredTrials || []) {
      await supabase
        .from("profiles")
        .update({ is_trial_active: false, plan_status: "expired" })
        .eq("user_id", profile.user_id);
    }

    console.log(`Expired ${expiredCount} subscriptions, ${expiredTrials?.length || 0} trials`);

    return new Response(
      JSON.stringify({ expired: expiredCount, trials_expired: expiredTrials?.length || 0 }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error expiring subscriptions:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
