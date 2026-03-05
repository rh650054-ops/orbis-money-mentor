import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get the authenticated user from the JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's CPF from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("cpf")
      .eq("user_id", user.id)
      .single();

    const cpf = profile?.cpf;

    if (!cpf) {
      // No CPF — check if email is whitelisted (for accounts without CPF)
      // Log audit
      await supabase.from("auth_audit").insert({
        cpf: "no_cpf",
        user_id: user.id,
        result: "skip",
        reason: "no_cpf_in_profile",
      });

      return new Response(
        JSON.stringify({ whitelisted: false, role: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check whitelist
    const { data: access } = await supabase
      .from("admin_access")
      .select("role, enabled")
      .eq("cpf", cpf)
      .maybeSingle();

    const whitelisted = !!access && access.enabled;
    const role = whitelisted ? access.role : null;

    // Log audit
    await supabase.from("auth_audit").insert({
      cpf,
      user_id: user.id,
      result: whitelisted ? "allowed" : "denied",
      reason: whitelisted ? `admin_access_whitelist_${role}` : "not_in_whitelist",
    });

    // If whitelisted, update profile flags
    if (whitelisted) {
      await supabase
        .from("profiles")
        .update({
          is_demo: true,
          billing_exempt: true,
          plan_status: "active",
          is_trial_active: false,
        })
        .eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({ whitelisted, role }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
