import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { cpf, password, name, phone, email } = await req.json();

    if (!cpf || !password || !name) {
      return new Response(
        JSON.stringify({ error: "cpf, password e name são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanedCpf = cpf.replace(/\D/g, "");
    if (cleanedCpf.length !== 11) {
      return new Response(
        JSON.stringify({ error: "CPF deve ter 11 dígitos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const internalEmail = `${cleanedCpf}@orbis.internal`;

    // Delete existing unconfirmed user with same email (cleanup of failed signups)
    const { data: existing } = await supabase.auth.admin.listUsers();
    const existingUser = existing?.users?.find((u) => u.email === internalEmail);
    if (existingUser) {
      await supabase.auth.admin.deleteUser(existingUser.id);
    }

    // Create user with email already confirmed (bypasses email confirmation requirement)
    const trialStart = new Date().toISOString().split("T")[0];
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 3);
    const trialEnd = trialEndDate.toISOString().split("T")[0];

    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { name, cpf: cleanedCpf, phone: phone || null },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (authData.user) {
      // Update profile with CPF, phone, email, and trial info
      await supabase
        .from("profiles")
        .update({
          cpf: cleanedCpf,
          phone: phone || null,
          email: email || null,
          nickname: name,
          trial_start: trialStart,
          trial_end: trialEnd,
          is_trial_active: true,
          plan_status: "trial",
        })
        .eq("user_id", authData.user.id);
    }

    return new Response(
      JSON.stringify({ success: true, userId: authData.user?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
