import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Orbis - analisar-bug (100% gratis: Cerebras -> Gemini, igual ao bright-action)
// Sem dependencia da API paga da Anthropic.
// Seguranca (21/10/2026): o painel de bugs chama com a chave publica, entao qualquer um
// podia mandar analisar sem parar e gastar a cota de IA. Agora: cada bug e analisado uma
// vez so, e no maximo 30 analises por hora no total.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LIMITE_HORA = 30;

function j(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

async function sbGet(id: string) {
  const r = await fetch(`${SB_URL}/rest/v1/orbis_bugs?id=eq.${encodeURIComponent(id)}&select=*`, { headers: H });
  const arr = await r.json();
  return Array.isArray(arr) ? arr[0] : null;
}

async function analisesUltimaHora(): Promise<number> {
  const desde = new Date(Date.now() - 3600_000).toISOString();
  const r = await fetch(`${SB_URL}/rest/v1/orbis_bugs?select=id&ai_analisado_em=gte.${desde}`, {
    headers: { ...H, Prefer: "count=exact", Range: "0-0" },
  });
  const total = Number((r.headers.get("content-range") ?? "").split("/")[1]);
  return Number.isFinite(total) ? total : 0;
}

async function sbPatch(id: string, patch: Record<string, unknown>) {
  await fetch(`${SB_URL}/rest/v1/orbis_bugs?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

const SYS = `Voce e o engenheiro senior do Orbis, um app (React + TypeScript + Vite, Supabase, Tailwind) para vendedores ambulantes. Analisa relatos de bug feitos por pessoas leigas (vendedores, nao devs) e responde em portugues do Brasil, direto e pratico. Responda SOMENTE com um objeto JSON valido, sem markdown, sem cercas de codigo, sem nenhum texto fora do JSON, com exatamente estas chaves:
{"diagnostico": "o que provavelmente esta acontecendo, em 1-2 frases claras", "causa": "a causa tecnica mais provavel no codigo/infra", "correcao": "passo a passo objetivo de como corrigir, do jeito que um dev resolveria", "severidade": "critico|alto|medio|baixo"}
Seja especifico e tecnico na causa e na correcao. Se faltar informacao, diga o que perguntar ao usuario. Sem emoji.`;

// deno-lint-ignore no-explicit-any
function buildUser(bug: any): string {
  const corta = (s: unknown, n: number) => String(s ?? "").slice(0, n);
  return `BUG REPORTADO\nTitulo: ${corta(bug.titulo, 200)}\nDescricao: ${corta(bug.descricao, 2000) || "(sem descricao)"}\nOnde acontece: ${corta(bug.tela, 200) || "(nao informado)"}\nGravidade informada: ${bug.severidade}\nReportado por: ${corta(bug.reporter, 80)}`;
}

// deno-lint-ignore no-explicit-any
function extrairJson(texto: string): any {
  const limpo = (texto || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const ini = limpo.indexOf("{"), fim = limpo.lastIndexOf("}");
  if (ini < 0 || fim < 0) return null;
  try { return JSON.parse(limpo.slice(ini, fim + 1)); } catch { return null; }
}

// 1) Cerebras (gratis)
async function viaCerebras(user: string): Promise<string | null> {
  const key = Deno.env.get("CEREBRAS_API_KEY");
  if (!key) return null;
  const model = Deno.env.get("CEREBRAS_MODEL") ?? "gpt-oss-120b";
  try {
    const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(22000),
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYS }, { role: "user", content: user }],
        temperature: 0.4,
        max_tokens: 700,
        top_p: 0.95,
      }),
    });
    if (!r.ok) { console.error("Cerebras erro", r.status); return null; }
    const cj = await r.json();
    return (cj?.choices?.[0]?.message?.content?.toString() ?? "").trim() || null;
  } catch (e) { console.error("Cerebras excecao", String(e).slice(0, 160)); return null; }
}

// 2) Gemini (gratis) - fallback
async function viaGemini(user: string): Promise<string | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(22000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYS }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 800, topP: 0.95 },
      }),
    });
    if (!r.ok) { console.error("Gemini erro", r.status); return null; }
    const data = await r.json();
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text?.toString() ?? "").trim() || null;
  } catch (e) { console.error("Gemini excecao", String(e).slice(0, 160)); return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { id } = await req.json();
    if (!id) return j({ erro: "id do bug nao enviado" }, 400);

    const bug = await sbGet(String(id));
    if (!bug) return j({ erro: "bug nao encontrado" }, 404);
    // uma analise por bug (pedir de novo devolve a que ja existe)
    if (bug.ai_status === "pronto" || bug.ai_status === "analisando") {
      return j({ ok: true, ja_analisado: true, diagnostico: bug.ai_diagnostico ?? "", causa: bug.ai_causa ?? "", correcao: bug.ai_correcao ?? "", severidade: bug.ai_severidade ?? bug.severidade });
    }
    if ((await analisesUltimaHora()) >= LIMITE_HORA) return j({ erro: "limite_por_hora" }, 429);

    await sbPatch(String(id), { ai_status: "analisando", ai_erro: null });

    const user = buildUser(bug);
    let texto = await viaCerebras(user);
    let fonte = "Cerebras";
    if (!texto) { texto = await viaGemini(user); fonte = "Gemini"; }

    if (!texto) {
      await sbPatch(String(id), { ai_status: "erro", ai_erro: "Nenhum provedor de IA gratis respondeu (Cerebras/Gemini). Confira os secrets CEREBRAS_API_KEY e GEMINI_API_KEY." });
      return j({ erro: "sem_provedor_ia" }, 200);
    }

    const parsed = extrairJson(texto) ?? { diagnostico: texto, causa: "", correcao: "", severidade: bug.severidade };
    const sev = ["critico", "alto", "medio", "baixo"].includes(parsed.severidade) ? parsed.severidade : bug.severidade;

    await sbPatch(String(id), {
      ai_status: "pronto",
      ai_diagnostico: parsed.diagnostico || "",
      ai_causa: parsed.causa || "",
      ai_correcao: parsed.correcao || "",
      ai_severidade: sev,
      ai_erro: null,
      ai_analisado_em: new Date().toISOString(),
    });
    return j({ ok: true, fonte, ...parsed, severidade: sev });
  } catch (e) {
    return j({ erro: String((e as Error).message || e) }, 200);
  }
});
