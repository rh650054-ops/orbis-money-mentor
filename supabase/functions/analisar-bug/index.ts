import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Vant — analisar-bug: AI analysis of bug reports, SWITCHED OFF on 26/11/2026 (Rick's decision,
// App Store 5.1.1(i) / 5.1.2(i) + LGPD).
// Why: a bug report is free text written by a person and is not linked to an account (the table
// has no user id), so nobody's permission can be checked before it goes to a third-party AI. The
// only protection was a regular-expression filter, which is not a guarantee of anonymisation, and
// the feature is not in the disclosure shown to the vendor. So nothing is sent to any AI from here.
// What still works: a report already analysed in the past gets its stored analysis back (read from
// our own database). Reports keep being saved and read by the team.
// To bring it back: link the report to its author, check the author's current AI permission
// (_shared/consentimento-ia.ts), add the feature to the disclosure, and only then call a provider
// (the text filter in _shared/sem-dados-pessoais.ts stays as a second layer, never the only one).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function j(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function sbGet(id: string) {
  const r = await fetch(`${SB_URL}/rest/v1/orbis_bugs?id=eq.${encodeURIComponent(id)}&select=ai_status,ai_diagnostico,ai_causa,ai_correcao,ai_severidade,severidade`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const arr = await r.json();
  return Array.isArray(arr) ? arr[0] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { id } = await req.json();
    if (!id) return j({ erro: "id do bug nao enviado" }, 400);

    const bug = await sbGet(String(id));
    if (!bug) return j({ erro: "bug nao encontrado" }, 404);
    // an analysis stored before the switch-off: returned as it is, nothing leaves our database
    if (bug.ai_status === "pronto") {
      return j({ ok: true, ja_analisado: true, diagnostico: bug.ai_diagnostico ?? "", causa: bug.ai_causa ?? "", correcao: bug.ai_correcao ?? "", severidade: bug.ai_severidade ?? bug.severidade });
    }
    return j({ erro: "analise_ia_desligada", mensagem: "A análise automática por IA está desligada. O relato continua salvo para a equipe." }, 200);
  } catch (e) {
    return j({ erro: String((e as Error).message || e) }, 200);
  }
});
