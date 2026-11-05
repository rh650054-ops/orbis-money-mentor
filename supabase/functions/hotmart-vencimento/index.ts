// Vant — hotmart-vencimento (Rick, 05/11/2026): changes the charge day of a Hotmart subscription
// (a seller who paid late and got a new charge a week later → his day moves to the day he paid).
// Door: x-orbis-cron header (painel_tokens nome='cron'), like hotmart-conferir. Body:
// { subscriber_code, due_day }. Credentials only from the Supabase panel (HOTMART_*).
// Hotmart confirms with UPDATE_SUBSCRIPTION_CHARGE_DATE on the webhook; nothing is written here.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tokenHotmart } from "../hotmart-webhook/cancelar-padrao.ts";

function mesmo(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

Deno.serve(async (req) => {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const enviado = req.headers.get("x-orbis-cron") ?? "";
    const { data: tk } = await admin.from("painel_tokens").select("token").eq("nome", "cron").maybeSingle();
    const esperado = String((tk as { token?: string } | null)?.token ?? "");
    if (!esperado || !mesmo(enviado, esperado)) return json({ error: "nao_autorizado" }, 401);

    const corpo = await req.json().catch(() => ({})) as { subscriber_code?: string; due_day?: number };
    const codigo = String(corpo.subscriber_code ?? "").trim();
    const dia = Number(corpo.due_day);
    if (!/^[A-Z0-9]{6,12}$/i.test(codigo) || !(dia >= 1 && dia <= 28)) return json({ error: "pedido_invalido" }, 400);

    const token = await tokenHotmart((k) => Deno.env.get(k));
    if (!token) return json({ error: "sem_credenciais" }, 500);
    const r = await fetch(`https://developers.hotmart.com/payments/api/v1/subscriptions/${encodeURIComponent(codigo)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ due_day: dia }),
      signal: AbortSignal.timeout(20000),
    });
    const texto = await r.text().catch(() => "");
    console.log("hotmart-vencimento", codigo, dia, r.status, texto.slice(0, 200));
    return json({ ok: r.ok, status: r.status, resposta: texto.slice(0, 300) }, r.ok ? 200 : 502);
  } catch (e) {
    console.error("hotmart-vencimento", e instanceof Error ? e.message : e);
    return json({ error: "erro_interno" }, 500);
  }
});
