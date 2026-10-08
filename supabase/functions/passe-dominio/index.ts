// Vant — passe-dominio (08/10/2026): carries a logged-in user from the old address
// (app.orbis.inf.br) to the new one (app.vantapp.com.br) without the password.
//
//   POST {acao:"criar"}            (logged in)  → { codigo }  one-time, 10 min
//   POST {acao:"trocar", codigo}   (no login)   → { token_hash } for supabase.auth.verifyOtp
//
// Sessions live per address in the browser, so the new address starts logged out.
// The old address asks for a code; the new one trades it for a magic-link token of
// the same user (generated server-side, no e-mail is sent). Only the SHA-256 of the
// code is stored; it expires in 10 minutes and is burnt on first use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const ORIGENS = new Set([
  "https://app.vantapp.com.br", "https://vantapp.com.br", "https://app.orbis.inf.br",
  "https://orbis-money-mentor-two.vercel.app",
]);
const corsDe = (req: Request) => {
  const o = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGENS.has(o) ? o : "https://app.vantapp.com.br",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

async function sha256(t: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function codigoNovo(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  const cors = corsDe(req);
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "metodo" }, 405);

  try {
    const URL_SUPA = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(URL_SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const corpo = await req.json().catch(() => ({})) as { acao?: string; codigo?: string };

    if (corpo.acao === "criar") {
      const auth = req.headers.get("Authorization") ?? "";
      const supa = createClient(URL_SUPA, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: auth } } });
      const { data: u } = await supa.auth.getUser();
      if (!u?.user?.id) return json({ error: "sem_login" }, 401);
      const codigo = codigoNovo();
      await admin.from("passes_dominio").delete().lt("expira_em", new Date().toISOString());
      const { error } = await admin.from("passes_dominio").insert({ codigo_hash: await sha256(codigo), user_id: u.user.id });
      if (error) { console.error("passe: criar", error.message); return json({ error: "erro_interno" }, 500); }
      return json({ codigo });
    }

    if (corpo.acao === "trocar") {
      const codigo = String(corpo.codigo ?? "");
      if (codigo.length < 30 || codigo.length > 64) return json({ error: "passe_invalido" }, 400);
      // burn it in the same statement that reads it: a code can never be used twice
      const { data: passe } = await admin.from("passes_dominio")
        .update({ usado_em: new Date().toISOString() })
        .eq("codigo_hash", await sha256(codigo)).is("usado_em", null).gt("expira_em", new Date().toISOString())
        .select("user_id").maybeSingle();
      if (!passe?.user_id) return json({ error: "passe_invalido" }, 400);
      const { data: quem } = await admin.auth.admin.getUserById(passe.user_id);
      const email = quem?.user?.email;
      if (!email) return json({ error: "sem_email" }, 400);
      const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      const token_hash = link?.properties?.hashed_token;
      if (error || !token_hash) { console.error("passe: link", error?.message); return json({ error: "erro_interno" }, 500); }
      return json({ token_hash });
    }

    return json({ error: "acao" }, 400);
  } catch (e) {
    console.error("passe-dominio", e);
    return json({ error: "erro_interno" }, 500);
  }
});
