// Vant — hotmart-receita. Admin-only summary of the ACTIVE Hotmart subscriptions (count and summed
// price), read from Hotmart's API (GET only; it writes nothing anywhere).
// 26/11/2026 (security): this function existed only in production and answered ANY logged-in
// caller, including `amostra`, the raw record of one subscriber. Now the caller must be logged in
// AND pass is_orbis_admin() (the same rule the refund uses). The check runs before any call to
// Hotmart, so a non-admin never triggers a read of subscriber data. The arithmetic is unchanged.
// Credentials only from the Supabase panel (HOTMART_*), never logged.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tokenHotmart } from "../hotmart-webhook/cancelar-padrao.ts";

const API = "https://developers.hotmart.com/payments/api/v1/subscriptions";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Item = any;

/** Price of one subscription: the first positive number among the places Hotmart may put it. */
export function extrairValor(it: Item): number {
  const cands = [it?.price?.value, it?.subscription?.price?.value, it?.plan?.price?.value, it?.subscription?.value, it?.value, it?.price, it?.plan?.price];
  for (const c of cands) { const n = Number(c); if (!isNaN(n) && n > 0) return n; }
  return 0;
}

export interface Quem { userId: string | null; admin: boolean }
export interface Deps {
  /** Who is calling, from the Authorization header, and whether is_orbis_admin() says yes. */
  quemE: (authorization: string) => Promise<Quem>;
  token: () => Promise<string | null>;
  busca: typeof fetch;
}

/** Fail closed: no session, an error, or anything other than `true` from is_orbis_admin = not admin. */
async function quemENoServidor(authorization: string): Promise<Quem> {
  if (!authorization) return { userId: null, admin: false };
  const comoUsuario = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return { userId: null, admin: false };
  const { data, error } = await comoUsuario.rpc("is_orbis_admin");
  return { userId: user.id, admin: !error && data === true };
}

const depsDoServidor: Deps = {
  quemE: quemENoServidor,
  token: () => tokenHotmart((k) => Deno.env.get(k)),
  busca: (...a) => fetch(...a),
};

export async function tratarReceita(req: Request, deps: Deps = depsDoServidor): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const quem = await deps.quemE(req.headers.get("Authorization") ?? "");
    if (!quem.userId) return json({ error: "nao_autorizado" }, 401);
    if (!quem.admin) {
      console.warn("hotmart-receita: denied, not an admin", quem.userId);
      return json({ error: "so_admin" }, 403);
    }

    const token = await deps.token();
    if (!token) return json({ error: "Falha ao autenticar na Hotmart" }, 502);
    let ativos = 0, receita = 0, amostra: Item = null, pages = 0, pageToken = "";
    do {
      const u = new URL(API);
      u.searchParams.set("status", "ACTIVE");
      u.searchParams.set("max_results", "50");
      if (pageToken) u.searchParams.set("page_token", pageToken);
      const r = await deps.busca(u.toString(), { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn("hotmart-receita: hotmart", r.status);
        return json({ error: "Falha ao buscar assinaturas" }, 502);
      }
      const items = d.items || d.data || [];
      for (const it of items) { ativos++; if (!amostra) amostra = it; receita += extrairValor(it); }
      pageToken = (d.page_info && d.page_info.next_page_token) || "";
      pages++;
    } while (pageToken && pages < 20);
    console.log("hotmart-receita: read by admin", quem.userId, JSON.stringify({ ativos, pages }));
    return json({ ativos, receita, amostra });
  } catch (e) {
    console.error("hotmart-receita:", e instanceof Error ? e.name : "error");
    return json({ error: "falha" }, 500);
  }
}

Deno.serve((req) => tratarReceita(req));
