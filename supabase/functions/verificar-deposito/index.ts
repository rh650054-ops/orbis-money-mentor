// Vant — verificar-deposito: closed. The X1 is points-only since 15/10/2026 (Rick, 14/10), so no
// new X1 wallet deposit is created or credited here. Payments created before the
// change are still reconciled by mp-webhook, and old balances are settled by an
// admin (x1_admin_wallet_move / x1_admin_resolve_withdraw). The previous code is
// in git history. The database also refuses new deposits (migration
// 20261015090000_x1_so_pontos.sql), so this is not the only guard.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "x1_so_pontos",
      dica: "O X1 agora vale só pontos: a carteira não recebe mais depósito. Saldo antigo? Fala com o suporte da Vant.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
