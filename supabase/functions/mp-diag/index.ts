// Vant — mp-diag v3: testa 4 jeitos de filtrar por data pra achar qual o MP aceita.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const u = new URL(req.url);
    const nonce = u.searchParams.get("nonce") ?? "";
    const userId = u.searchParams.get("user_id") ?? "";
    const { data: n } = await admin.from("setup_nonces").select("*").eq("nonce", nonce).maybeSingle();
    const ok = !!n && (n as any).para === "mp-diag" && !(n as any).usado_em && Date.now() - new Date((n as any).criado_em).getTime() < 15 * 60_000;
    if (!ok) return json({ error: "nonce_invalido" }, 403);
    await admin.from("setup_nonces").update({ usado_em: new Date().toISOString() }).eq("nonce", nonce);
    const { data: con } = await admin.from("mp_conexoes").select("access_token").eq("user_id", userId).eq("provedor", "mercadopago").eq("ativo", true).maybeSingle();
    if (!con) return json({ erro: "sem_conexao" });
    const H = { Authorization: `Bearer ${(con as any).access_token}` };

    const ini = new Date(Date.now() - 10 * 86400_000).toISOString();
    const fim = new Date().toISOString();
    const mpIso = (d: string) => d.replace(/\.\d{3}Z$/, ".000-00:00"); // formato que o MP documenta
    const testes: Record<string, string> = {
      A_como_esta_hoje_NOW:      `range=date_created&begin_date=${encodeURIComponent(ini)}&end_date=NOW`,
      B_end_date_iso:            `range=date_created&begin_date=${encodeURIComponent(ini)}&end_date=${encodeURIComponent(fim)}`,
      C_formato_mp_com_offset:   `range=date_created&begin_date=${encodeURIComponent(mpIso(ini))}&end_date=${encodeURIComponent(mpIso(fim))}`,
      D_so_begin_date:           `range=date_created&begin_date=${encodeURIComponent(mpIso(ini))}`,
      E_date_approved:           `range=date_approved&begin_date=${encodeURIComponent(mpIso(ini))}&end_date=${encodeURIComponent(mpIso(fim))}`,
    };
    const out: Record<string, unknown> = {};
    for (const [nome, q] of Object.entries(testes)) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=5&${q}`, { headers: H, signal: AbortSignal.timeout(20000) });
      const j = await r.json().catch(() => ({} as any));
      const res: any[] = j?.results ?? [];
      out[nome] = { http: r.status, total: j?.paging?.total ?? null, veio: res.length,
        dias: res.map((p) => String(p?.date_approved ?? p?.date_created ?? "").slice(0, 10)),
        erro: r.ok ? null : JSON.stringify(j).slice(0, 200) };
    }
    return json(out);
  } catch (e) { return json({ error: "erro_interno", detalhe: String(e).slice(0, 200) }, 500); }
});
