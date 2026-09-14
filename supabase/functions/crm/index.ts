// Serve o painel do Mini-CRM (HTML guardado em public.crm_assets, id='painel')
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let cache: string | null = null;
let cacheAt = 0;

async function getHtml(): Promise<string> {
  const now = Date.now();
  if (cache && now - cacheAt < 60_000) return cache;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/crm_assets?select=content&id=eq.painel`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Accept: "application/json",
      },
    },
  );
  if (!res.ok) throw new Error(`asset fetch ${res.status}`);
  const rows = await res.json();
  const html = rows?.[0]?.content;
  if (!html) throw new Error("asset 'painel' vazio");
  cache = html;
  cacheAt = now;
  return html;
}

Deno.serve(async () => {
  try {
    const html = await getHtml();
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return new Response(
      `Painel indisponível: ${(err as Error).message}`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
});
