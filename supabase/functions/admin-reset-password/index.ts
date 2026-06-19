import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Gera uma senha temporária no formato OrbisXXXXXX! */
function generateTempPassword(): string {
  const digits = Math.floor(100000 + Math.random() * 900000).toString();
  return `Orbis${digits}!`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ---- Autorizacao: JWT valido + CPF na tabela admin_access ----
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin = CPF do caller está na tabela admin_access
    const { data: adminRole } = await adminClient.from("admin_access").select("cpf").limit(200);
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

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin não pode resetar a própria senha por aqui (use o fluxo normal)
    if (userId === caller.id) {
      return new Response(
        JSON.stringify({ error: "Use o fluxo normal para alterar sua própria senha." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tempPassword = generateTempPassword();

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Falha ao redefinir senha: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Marca o usuário para forçar troca de senha no próximo login
    await adminClient
      .from("profiles")
      .update({ must_change_password: true } as any)
      .eq("user_id", userId);

    console.log(`admin-reset-password: senha redefinida para user ${userId} pelo admin ${caller.id}`);

    return new Response(
      JSON.stringify({ success: true, tempPassword }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
