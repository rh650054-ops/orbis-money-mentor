// Retired 18/10/2026 (security sweep): this debug function could read any
// user's bank/payment data with a one-time code. It now answers 410 Gone.
// The old code is in git history if a diagnosis is ever needed again.
Deno.serve(() => new Response(JSON.stringify({ error: "desativado" }), {
  status: 410,
  headers: { "Content-Type": "application/json" },
}));
