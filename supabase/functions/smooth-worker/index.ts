// Vant — smooth-worker: RETIRED on 26/11/2026.
// It was an old copy of generate-insights that only existed in production (never in this
// repository): any logged-in caller could send sales numbers to Google Gemini through it, with no
// AI permission check. No screen of the app called it. The reports are generate-insights.
Deno.serve(() => new Response(JSON.stringify({ error: "gone", detail: "smooth-worker was retired; reports are served by generate-insights" }), { status: 410, headers: { "Content-Type": "application/json" } }));
