import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const cpfAccountId = "76b8ce01-9700-41ee-9f8b-a1ee6ab9dd19"; // 24009306866@orbis.internal
  const emailAccountId = "82d83991-1257-49ff-87a1-48dd82c9e9b8"; // yanfarias2002@gmail.com

  const results: string[] = [];

  try {
    // 1. Transfer subscription from email account to CPF account
    const { error: subError } = await adminClient
      .from("subscriptions")
      .update({ user_id: cpfAccountId })
      .eq("user_id", emailAccountId);
    results.push(subError ? `Sub transfer error: ${subError.message}` : "✅ Subscription transferred to CPF account");

    // 2. Update CPF account profile to active
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        plan_status: "active",
        plan_type: "pro",
        is_trial_active: false,
        cpf: "24009306866",
        email: "yanfarias2002@gmail.com",
        nickname: "Yan Farias",
      })
      .eq("user_id", cpfAccountId);
    results.push(profileError ? `Profile update error: ${profileError.message}` : "✅ CPF account profile updated to active");

    // 3. Deactivate the email-only account
    const { error: deactivateError } = await adminClient
      .from("profiles")
      .update({
        plan_status: "merged",
        is_trial_active: false,
      })
      .eq("user_id", emailAccountId);
    results.push(deactivateError ? `Deactivate error: ${deactivateError.message}` : "✅ Email-only account marked as merged");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Yan pode agora fazer login com CPF 24009306866. Assinatura transferida.",
        steps: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, steps: results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
