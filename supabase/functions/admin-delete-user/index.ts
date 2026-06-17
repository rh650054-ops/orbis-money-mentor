import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

// Tabelas que pertencem ao usuário. Apagamos tudo (best-effort) antes de remover
// o profile e o usuario do Auth, pra liberar CPF/e-mail e nao deixar orfaos.
const USER_TABLES = [
  "leaderboard_stats",
  "work_sessions",
  "streak",
  "monthly_challenge",
  "ai_messages",
  "ai_conversations",
  "ai_usage",
  "daily_sales",
  "routines",
  "challenge_blocks",
  "insights",
  "rewards",
  "pix_accounts",
  "user_roles",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    const adminSecret = req.headers.get("x-admin-secret");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ---- Autorizacao: service role (x-admin-secret) OU admin logado ----
    const isServiceRole = adminSecret === serviceRoleKey;

    if (!isServiceRole) {
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

      // admin = CPF do caller esta na tabela admin_access
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

      // Seguranca: admin nao pode se autoexcluir por aqui
      const body = await req.clone().json().catch(() => ({}));
      if (body?.userId && body.userId === caller.id) {
        return new Response(
          JSON.stringify({ error: "Voce nao pode excluir a sua propria conta de admin por aqui." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const { userId, email, cpf } = await req.json();

    // ---- Resolve o user_id alvo ----
    let targetUserId: string | null = userId ?? null;
    if (!targetUserId && (email || cpf)) {
      let q = adminClient.from("profiles").select("user_id").limit(1);
      if (email) q = q.eq("email", String(email).trim());
      else if (cpf) q = q.eq("cpf", String(cpf).replace(/\D/g, ""));
      const { data: prof } = await q.maybeSingle();
      targetUserId = (prof as any)?.user_id ?? null;
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "Informe userId (ou email/cpf) de uma conta existente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Apaga dados do usuario (best-effort, nao falha se a tabela nao existir) ----
    const cleaned: string[] = [];
    for (const table of USER_TABLES) {
      try {
        const { error } = await adminClient.from(table).delete().eq("user_id", targetUserId);
        if (!error) cleaned.push(table);
      } catch (_e) {
        /* tabela pode nao existir ou nao ter user_id — ignora */
      }
    }

    // ---- Apaga o profile (libera CPF e e-mail guardados no profile) ----
    const { error: profErr } = await adminClient.from("profiles").delete().eq("user_id", targetUserId);
    if (profErr) {
      return new Response(
        JSON.stringify({ error: `Falha ao apagar o profile: ${profErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Apaga o usuario do Auth (libera o e-mail de login; tira do sistema) ----
    const { error: authErr } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (authErr) {
      return new Response(
        JSON.stringify({
          error: `Profile apagado, mas falhou ao remover do Auth: ${authErr.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Conta excluida por completo. CPF e e-mail liberados para um novo cadastro do zero.",
        userId: targetUserId,
        cleanedTables: cleaned,
      }),
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
