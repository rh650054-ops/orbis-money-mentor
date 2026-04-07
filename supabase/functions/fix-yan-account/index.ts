import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-time function to fix Yan's account - will be deleted after use
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const targetUserId = "82d83991-1257-49ff-87a1-48dd82c9e9b8";
  const newEmail = "24009306866@orbis.internal";

  try {
    // Update auth email
    const { error: authError } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      { email: newEmail, email_confirm: true }
    );

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure CPF is set in profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ cpf: "24009306866" })
      .eq("user_id", targetUserId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Yan's auth email updated to 24009306866@orbis.internal. He can now login with CPF.",
        profile_update_error: profileError?.message || null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
