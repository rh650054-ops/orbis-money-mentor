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

  const targetUserId = "82d83991-1257-49ff-87a1-48dd82c9e9b8";
  const newEmail = "24009306866@orbis.internal";

  try {
    // First check current auth user
    const { data: userData, error: getUserError } = await adminClient.auth.admin.getUserById(targetUserId);
    console.log("Current auth user:", JSON.stringify({ email: userData?.user?.email, id: userData?.user?.id, error: getUserError?.message }));

    // Check if target email already exists
    const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existing = listData?.users?.find((u: any) => u.email === newEmail);
    console.log("Existing user with target email:", existing ? existing.id : "none");

    if (existing && existing.id !== targetUserId) {
      return new Response(JSON.stringify({ 
        error: "Another auth user already has email 24009306866@orbis.internal",
        existing_user_id: existing.id 
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update auth email
    const { data: updateData, error: authError } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      { email: newEmail, email_confirm: true }
    );

    console.log("Update result:", JSON.stringify({ 
      success: !!updateData?.user, 
      newEmail: updateData?.user?.email,
      error: authError?.message,
      errorStatus: authError?.status
    }));

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message, details: JSON.stringify(authError) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure CPF is set in profile
    await adminClient.from("profiles").update({ cpf: "24009306866" }).eq("user_id", targetUserId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Done! Yan can now login with CPF 24009306866.",
        previous_email: userData?.user?.email,
        new_email: updateData?.user?.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Exception:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
