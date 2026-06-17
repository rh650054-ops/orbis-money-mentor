import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
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
    if (!isValidCpf(cleanedCpf)) {
      return new Response(
        JSON.stringify({ error: "CPF inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const internalEmail = `${cleanedCpf}@orbis.internal`;

    // SECURITY: only delete an existing account if it was NEVER confirmed and
    // NEVER logged in (cleanup of an abandoned/failed signup). If a real account
    // already exists for this CPF we must refuse — otherwise anyone who knows a
    // CPF (semi-public in Brazil) could wipe and take over that account.
    const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existingUser = existing?.users?.find((u) => u.email === internalEmail);
    if (existingUser) {
      const isConfirmed = !!(existingUser.email_confirmed_at || existingUser.last_sign_in_at);
      if (isConfirmed) {
        return new Response(
          JSON.stringify({ error: "Este CPF já possui uma conta. Faça login ou recupere a senha." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Unconfirmed leftover from a failed signup — safe to clean up.
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
