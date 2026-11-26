// Vant — analisar-anomalia. AI verdict SWITCHED OFF on 26/11/2026 (Rick: "cortar no servidor").
// It used to send a vendor's nickname and 30 days of daily history to a third-party AI (Anthropic)
// when an admin asked. That purpose is not in the AI disclosure the vendor accepts in the app
// (src/features/consentimento-ia → texto-ia.tsx), so nothing is sent any more: this function reads
// nothing and calls no provider. The admin keeps the history table and the other anti-cheat
// signals of the panel, and judges by hand. To bring the AI verdict back, add it to the disclosure
// first (new version, new consent), then restore the previous code from the repository history.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // 200 with `error`: the admin panel shows this sentence in place of the verdict.
  return new Response(
    JSON.stringify({ ok: false, error: "Análise por IA desligada: analise pelo histórico de vendas.", codigo: "analise_ia_desligada" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
