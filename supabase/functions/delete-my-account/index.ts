// LGPD: exclusão de conta pelo PRÓPRIO usuário (self-service).
// Autenticado (verify_jwt), exige confirmação explícita no body, apaga todos os
// dados via RPC apagar_dados_do_usuario e remove o usuário do Auth.
//
// Versioned in the repo on 07/10/2026, identical to the deployed v25. Apple
// (guideline 5.1.1(v)) and Google Play both require in-app account deletion;
// this function is what "Minha Conta > Excluir minha conta" calls.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) return json({ error: "Invalid token" }, 401);

    const { confirmacao } = await req.json().catch(() => ({ confirmacao: "" }));
    if (confirmacao !== "EXCLUIR") {
      return json({ error: 'Confirmação inválida. Envie { "confirmacao": "EXCLUIR" }.' }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: resumo, error: rpcErr } = await adminClient.rpc("apagar_dados_do_usuario", {
      p_user: caller.id,
    });
    if (rpcErr) return json({ error: `Falha ao apagar os dados: ${rpcErr.message}` }, 500);

    const { error: authErr } = await adminClient.auth.admin.deleteUser(caller.id);
    if (authErr) {
      return json({ error: `Dados apagados, mas falhou ao remover o login: ${authErr.message}` }, 500);
    }

    console.log(`[lgpd] conta ${caller.id} excluída`, resumo);
    return json({ success: true, message: "Conta e dados excluídos por completo.", resumo });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return json({ error: msg }, 500);
  }
});
