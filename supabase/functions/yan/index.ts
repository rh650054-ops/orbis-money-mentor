// Orbis — CRM de SUPORTE do Yan (API de dados). A interface é o yan.html (na Vercel),
// que chama estes endpoints. Protegido por TOKEN na URL; os dados são lidos no servidor
// com a service key (nunca expõe a base com chave pública). verify_jwt = false (trava = token).
//   GET  /yan?token=..&action=list            -> { pessoas:[...], msg }
//   POST /yan?token=..&action=estagio {chave, estagio}
//   POST /yan?token=..&action=notas   {chave, notas}
//   GET/POST /yan?token=..&action=msg {msg}
const SB = Deno.env.get("SUPABASE_URL")!;
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = "yan-orbis-2p9Qm7Kx";
const MSG_DEFAULT =
  "Oi {nome}! Aqui é o Yan, do Orbis. Vi que você entrou no app — seja bem-vindo! Posso te dar uma força rapidinho pra você começar a usar e aproveitar seus dias grátis?";

async function rest(path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,OPTIONS" } });
  const url = new URL(req.url);
  if ((url.searchParams.get("token") || "") !== TOKEN) return new Response("Acesso negado.", { status: 403 });
  const action = url.searchParams.get("action") || "";

  try {
    if (action === "list") {
      const pessoas = await rest(`rpc/crm_suporte_lista`, { method: "POST", body: "{}" });
      const cfg = await rest(`crm_config?select=msg_boas_vindas&id=eq.1`).catch(() => []);
      return j({ pessoas: pessoas || [], msg: cfg?.[0]?.msg_boas_vindas || MSG_DEFAULT });
    }
    if ((action === "estagio" || action === "notas" || action === "atividade") && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      const chave = String(b?.chave || "").slice(0, 80);
      if (!chave) return j({ erro: "sem_chave" }, 400);
      const payload: Record<string, unknown> = { chave, atualizado_em: new Date().toISOString(), por: "Yan" };
      if (action === "estagio") payload.estagio = String(b?.estagio || "").slice(0, 40) || null;
      else if (action === "atividade") {
        // marca (data de hoje em SP) ou desmarca (null) a atividade diária do lead
        const hojeSP = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
        payload.atividade_em = b?.feito === false ? null : hojeSP;
      }
      else payload.notas = String(b?.notas || "").slice(0, 2000);
      await rest(`crm_suporte?on_conflict=chave`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(payload),
      });
      return j({ ok: true });
    }
    if (action === "msg") {
      if (req.method === "POST") {
        const b = await req.json().catch(() => ({}));
        await rest(`crm_config?id=eq.1`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ msg_boas_vindas: String(b?.msg || "").slice(0, 1000) }) });
        return j({ ok: true });
      }
      const cfg = await rest(`crm_config?select=msg_boas_vindas&id=eq.1`).catch(() => []);
      return j({ msg: cfg?.[0]?.msg_boas_vindas || MSG_DEFAULT });
    }
    return new Response("Orbis CRM (Yan) — use o yan.html na Vercel. API ativa.", { headers: { "content-type": "text/plain; charset=utf-8" } });
  } catch (e) {
    return j({ erro: String(e).slice(0, 200) }, 500);
  }
});
