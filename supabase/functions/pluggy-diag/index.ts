// Orbis — pluggy-diag (temporaria). Porta: nonce de uso unico.
// v6 (10/09/2026): ?item=<id> mostra o que a Pluggy tem daquele item — contas e
// transacoes dos ultimos 30 dias (so data/tipo/valor, sem descricao).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const url = new URL(req.url);
    const nonce = url.searchParams.get("nonce") ?? "";
    const { data: n } = await admin.from("setup_nonces").select("*").eq("nonce", nonce).maybeSingle();
    const ok = !!n && (n as any).para === "pluggy-diag" && !(n as any).usado_em
      && Date.now() - new Date((n as any).criado_em).getTime() < 15 * 60_000;
    if (!ok) return json({ error: "nonce_invalido" }, 403);
    await admin.from("setup_nonces").update({ usado_em: new Date().toISOString() }).eq("nonce", nonce);

    const id = Deno.env.get("PLUGGY_CLIENT_ID") ?? "";
    const secret = Deno.env.get("PLUGGY_CLIENT_SECRET") ?? "";
    if (!id || !secret) return json({ erro: "faltam_credenciais" });

    const r = await fetch("https://api.pluggy.ai/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id, clientSecret: secret }),
      signal: AbortSignal.timeout(20000),
    });
    const txt = await r.text();
    let apiKey = "";
    try { apiKey = JSON.parse(txt)?.apiKey ?? ""; } catch { /* nada */ }
    if (!r.ok || !apiKey) return json({ autenticou: false, http: r.status, detalhe: txt.slice(0, 200) });
    const H = { "X-API-KEY": apiKey };
    const get = async (u: string) => {
      const c = await fetch(u, { headers: H, signal: AbortSignal.timeout(25000) });
      const t = await c.text();
      let j: any = null; try { j = JSON.parse(t); } catch { /* nada */ }
      return { http: c.status, j, t: t.slice(0, 300) };
    };

    const item = url.searchParams.get("item");
    if (item) {
      const it = await get(`https://api.pluggy.ai/items/${encodeURIComponent(item)}`);
      const contas = await get(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(item)}`);
      const lista: any[] = contas.j?.results ?? [];
      const desde = new Date(); desde.setDate(desde.getDate() - 30);
      const de = desde.toISOString().split("T")[0];
      const porConta = [] as any[];
      for (const c of lista) {
        const tx = await get(`https://api.pluggy.ai/transactions?accountId=${encodeURIComponent(c.id)}&from=${de}&pageSize=100`);
        const rs: any[] = tx.j?.results ?? [];
        porConta.push({
          conta: { id: c.id, tipo: c.type, subtipo: c.subtype, nome: c.name, saldo_tem: c.balance != null },
          http: tx.http, total: tx.j?.total, pagina: rs.length,
          erro: tx.j ? undefined : tx.t,
          credit: rs.filter((t) => t?.type === "CREDIT").length,
          debit: rs.filter((t) => t?.type === "DEBIT").length,
          datas: rs.slice(0, 5).map((t) => ({ data: String(t?.date ?? "").slice(0, 10), tipo: t?.type, valor: t?.amount, status: t?.status })),
        });
      }
      return json({
        item: { http: it.http, status: it.j?.status, conector: it.j?.connector?.name, executionStatus: it.j?.executionStatus,
          lastUpdatedAt: it.j?.lastUpdatedAt, statusDetail: it.j?.statusDetail, erro: it.j?.error, clientUserId: it.j?.clientUserId },
        contas_http: contas.http, contas_total: lista.length, contas_erro: contas.j ? undefined : contas.t,
        por_conta: porConta,
      });
    }

    const pegar = async (sandbox: boolean) => {
      const u = `https://api.pluggy.ai/connectors?countries=BR&pageSize=500&sandbox=${sandbox}`;
      const c = await fetch(u, { headers: H, signal: AbortSignal.timeout(25000) });
      if (!c.ok) return [] as any[];
      return ((await c.json().catch(() => ({} as any)))?.results ?? []) as any[];
    };
    const semSandbox = await pegar(false);
    const comSandbox = await pegar(true);
    const achaMeu = (lista: any[]) =>
      lista.filter((c) => /meu.?pluggy|pluggy/i.test(String(c?.name ?? "")))
           .map((c) => ({ id: c?.id, nome: c?.name, tipo: c?.type, sandbox: !!c?.isSandbox, oauth: !!c?.oauth }));
    let itens: any[] = [];
    try {
      const it = await fetch("https://api.pluggy.ai/items?pageSize=20", { headers: H, signal: AbortSignal.timeout(20000) });
      if (it.ok) itens = ((await it.json().catch(() => ({} as any)))?.results ?? []) as any[];
    } catch { /* nada */ }
    return json({
      autenticou: true,
      conectores_producao: semSandbox.length,
      conectores_sandbox: comSandbox.length,
      meu_pluggy_em_producao: achaMeu(semSandbox),
      meu_pluggy_em_sandbox: achaMeu(comSandbox),
      itens_existentes: itens.length,
      itens: itens.map((i) => ({ id: i?.id, conector: i?.connector?.name, status: i?.status, criado: i?.createdAt })),
    });
  } catch (e) {
    console.error("pluggy-diag", e);
    return json({ error: "erro_interno", detalhe: String(e).slice(0, 200) }, 500);
  }
});
