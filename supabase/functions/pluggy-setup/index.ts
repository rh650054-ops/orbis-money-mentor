// Vant — pluggy-setup: cadastra o webhook da Pluggy SOZINHO.
//
// Por que existe: o segredo do webhook e uma palavra que precisa ser identica
// nos dois lados. Digitar a mesma coisa em dois paineis diferentes e o tipo de
// tarefa que erra 100% das vezes. Entao a Vant gera a palavra, guarda no banco
// e cadastra o endereco na Pluggy pela API deles. Ninguem digita nada.
//
// A resposta mostra o endereco com o segredo MASCARADO.
// Porta: nonce de uso unico criado direto no banco (setup_nonces).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };
const mascarar = (u: string) => u.replace(/([?&]secret=)[^&]*/i, "$1***");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const URL_SUPA = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(URL_SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const nonce = new URL(req.url).searchParams.get("nonce") ?? "";
    const { data: n } = await admin.from("setup_nonces").select("*").eq("nonce", nonce).maybeSingle();
    const ok = !!n && (n as any).para === "pluggy-setup" && !(n as any).usado_em
      && Date.now() - new Date((n as any).criado_em).getTime() < 15 * 60_000;
    if (!ok) return json({ error: "nonce_invalido" }, 403);
    await admin.from("setup_nonces").update({ usado_em: new Date().toISOString() }).eq("nonce", nonce);

    const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
    const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
    if (!clientId || !clientSecret) return json({ error: "pluggy_nao_configurado" });

    const authRes = await fetch("https://api.pluggy.ai/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
      signal: AbortSignal.timeout(20000),
    });
    if (!authRes.ok) return json({ error: "pluggy_auth", http: authRes.status });
    const { apiKey } = await authRes.json();
    const H = { "X-API-KEY": apiKey, "Content-Type": "application/json" };

    // ---- segredo novo, aleatorio, gerado aqui dentro
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const segredo = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const url = `${URL_SUPA}/functions/v1/pluggy-webhook?secret=${segredo}`;

    // ---- limpa os webhooks antigos que apontam pra Vant (inclusive o quebrado)
    const apagados: string[] = [];
    try {
      const w = await fetch("https://api.pluggy.ai/webhooks", { headers: H, signal: AbortSignal.timeout(20000) });
      if (w.ok) {
        const lista: any[] = (await w.json().catch(() => ({} as any)))?.results ?? [];
        for (const x of lista) {
          if (!String(x?.url ?? "").includes("/functions/v1/pluggy-webhook")) continue;
          const d = await fetch(`https://api.pluggy.ai/webhooks/${encodeURIComponent(String(x.id))}`, {
            method: "DELETE", headers: H, signal: AbortSignal.timeout(20000),
          });
          apagados.push(`${x.id}:${d.status}`);
        }
      }
    } catch { /* seguir mesmo assim: o importante e criar o novo */ }

    // ---- cadastra o novo
    const c = await fetch("https://api.pluggy.ai/webhooks", {
      method: "POST", headers: H,
      body: JSON.stringify({ url, event: "all" }),
      signal: AbortSignal.timeout(20000),
    });
    const corpo = await c.text();
    if (!c.ok) {
      console.error("pluggy-setup criar webhook", c.status, corpo.slice(0, 300));
      return json({ error: "criar_webhook", http: c.status, detalhe: corpo.slice(0, 200), apagados });
    }
    let criado: any = {};
    try { criado = JSON.parse(corpo); } catch { /* nada */ }

    // ---- guarda o segredo no banco (o pluggy-webhook confere por aqui)
    await admin.from("pluggy_config").upsert({
      id: "orbis",
      webhook_secret: segredo,
      webhook_id: String(criado?.id ?? ""),
      webhook_url: url,
      atualizado_em: new Date().toISOString(),
    });

    return json({
      ok: true,
      webhooks_antigos_apagados: apagados,
      webhook_criado: !!criado?.id,
      evento: criado?.event ?? null,
      url: mascarar(url),
    });
  } catch (e) {
    console.error("pluggy-setup", e);
    return json({ error: "erro_interno" }, 500);
  }
});
