import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if using service role key directly
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      // Verify caller is admin user
      const anonClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user: caller } } = await anonClient.auth.getUser();
      if (!caller) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const { data: adminRole } = await adminClient
        .from("admin_access")
        .select("cpf")
        .limit(100);
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("cpf")
        .eq("user_id", caller.id)
        .single();

      const isAdmin =
        callerProfile?.cpf &&
        adminRole?.some((a: { cpf: string }) => a.cpf === callerProfile.cpf);

      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { email, cpf } = await req.json();

    if (!email || !cpf) {
      return new Response(
        JSON.stringify({ error: "email and cpf are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return new Response(
        JSON.stringify({ error: "CPF must have 11 digits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const internalEmail = `${cleanCpf}@orbis.internal`;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Find user by email in profiles
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("user_id, nickname")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: `Profile not found for email: ${email}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if CPF is already used by another user
    const { data: existingCpf } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("cpf", cleanCpf)
      .neq("user_id", profile.user_id)
      .maybeSingle();

    if (existingCpf) {
      return new Response(
        JSON.stringify({ error: "This CPF is already linked to another account" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update auth email to CPF@orbis.internal
    const { error: authUpdateError } =
      await adminClient.auth.admin.updateUserById(profile.user_id, {
        email: internalEmail,
        email_confirm: true,
      });

    if (authUpdateError) {
      return new Response(
        JSON.stringify({ error: `Failed to update auth email: ${authUpdateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile with CPF
    const { error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({ cpf: cleanCpf })
      .eq("user_id", profile.user_id);

    if (profileUpdateError) {
      return new Response(
        JSON.stringify({ error: `Failed to update profile: ${profileUpdateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `CPF ${cleanCpf} linked to account ${email}. User can now login with CPF.`,
        user_id: profile.user_id,
        new_auth_email: internalEmail,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
