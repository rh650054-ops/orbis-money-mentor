// Orbis — cobranca-criar: gera um Pix NA CARTEIRA DO PRÓPRIO VENDEDOR.
// O dinheiro vai direto do cliente pra conta dele; o Orbis nunca toca no dinheiro,
// só guarda o link, o copia-e-cola e o status pra dar baixa depois.
//
// verify_jwt=false porque a conferência do login é feita aqui dentro (mesmo padrão
// do mp-sync). Sem login válido, não passa.
//
// Entrada:  { client_id?, nome, telefone?, valor, descricao?, horas?, abate_calote? }
//   abate_calote=false  → a cobranca nasceu JUNTO com a venda no DEFCON (a venda
//                         ja foi lancada naquele segundo). Quando pagar, so
//                         confirma — nao soma de novo no dia.
//   abate_calote=true   → nasceu depois: o pagamento abate o calote. (padrao)
// Saída:    { ok, id, link, copia_cola, qr_base64, expira_em }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const URL_SUPA = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const brDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

// data de expiração no formato que o MP aceita: ...-03:00 (Brasil não tem horário de verão)
function expiraISO(horas: number) {
  const t = new Date(Date.now() + horas * 3600_000 - 3 * 3600_000);
  return `${t.toISOString().slice(0, 23)}-03:00`;
}

// renova o token do vendedor quando falta pouco pra vencer (igual mp-sync)
async function renovar(admin: any, con: any) {
  const clientId = Deno.env.get("MP_CLIENT_ID");
  const clientSecret = Deno.env.get("MP_CLIENT_SECRET");
  if (!clientId || !clientSecret || !con.refresh_token) return con.access_token;
  const r = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: con.refresh_token }),
    signal: AbortSignal.timeout(20000),
  });
  const tk = await r.json().catch(() => ({}));
  if (!r.ok || !tk?.access_token) return con.access_token;
  await admin.from("mp_conexoes").update({
    access_token: tk.access_token,
    refresh_token: tk.refresh_token ?? con.refresh_token,
    expira_em: new Date(Date.now() + (Number(tk.expires_in) || 15552000) * 1000).toISOString(),
    ultimo_erro: null,
  }).eq("user_id", con.user_id).eq("provedor", "mercadopago");
  return tk.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth || auth.includes(SERVICE)) return json({ error: "sem_login" }, 401);

    const supa = createClient(URL_SUPA, ANON, { global: { headers: { Authorization: auth } } });
    const { data: u } = await supa.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "sem_login" }, 401);

    const body = await req.json().catch(() => ({} as any));
    const valor = Math.round((Number(body?.valor) || 0) * 100) / 100;
    const nome = String(body?.nome ?? "").trim().slice(0, 60);
    const telefone = String(body?.telefone ?? "").replace(/\D/g, "").slice(0, 13);
    const descricao = String(body?.descricao ?? "").trim().slice(0, 100) || "Cobranca Orbis";
    const clientId = body?.client_id ? String(body.client_id) : null;
    const horas = Math.min(720, Math.max(1, Number(body?.horas) || 48));
    const abate = body?.abate_calote === false ? false : true;

    if (valor <= 0) return json({ error: "valor_invalido" }, 400);
    if (valor > 20000) return json({ error: "valor_alto" }, 400);

    const admin = createClient(URL_SUPA, SERVICE);

    const { data: con } = await admin.from("mp_conexoes").select("*")
      .eq("user_id", uid).eq("provedor", "mercadopago").eq("ativo", true).maybeSingle();
    if (!con) return json({ error: "sem_conexao" });

    let token = (con as any).access_token as string;
    if (new Date((con as any).expira_em).getTime() - Date.now() < 15 * 86400_000) token = await renovar(admin, con);

    // nosso identificador — é por ele que o webhook reencontra a cobranca
    const ref = crypto.randomUUID();
    const expira = expiraISO(horas);

    // e-mail do pagador é obrigatório na API do MP. Como o cliente do camelô
    // não tem e-mail cadastrado, vai um endereco tecnico do proprio Orbis —
    // nada e enviado pra ele; quem paga usa o QR ou o copia-e-cola.
    const pagadorEmail = `cobranca+${ref.slice(0, 8)}@orbis.inf.br`;
    const partes = nome.split(/\s+/).filter(Boolean);

    const notif = `${URL_SUPA}/functions/v1/mp-webhook?user_id=${encodeURIComponent(String((con as any).mp_user_id ?? ""))}`;

    const r = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": ref,
      },
      body: JSON.stringify({
        transaction_amount: valor,
        description: descricao,
        payment_method_id: "pix",
        external_reference: ref,
        notification_url: notif,
        date_of_expiration: expira,
        payer: {
          email: pagadorEmail,
          first_name: partes[0] || "Cliente",
          last_name: partes.slice(1).join(" ") || "Orbis",
        },
      }),
      signal: AbortSignal.timeout(25000),
    });

    const pay = await r.json().catch(() => ({} as any));
    if (!r.ok || !pay?.id) {
      const motivo = String(pay?.message ?? pay?.error ?? `http_${r.status}`).slice(0, 160);
      console.error("cobranca-criar MP erro", r.status, motivo);
      return json({ error: "carteira_recusou", detalhe: motivo }, 200);
    }

    const td = pay?.point_of_interaction?.transaction_data ?? {};
    const link = String(td?.ticket_url ?? "");
    const copia = String(td?.qr_code ?? "");
    const qr64 = String(td?.qr_code_base64 ?? "");

    const { data: cob, error: errIns } = await admin.from("cobrancas").insert({
      user_id: uid,
      provedor: "mercadopago",
      cliente_nome: nome || null,
      cliente_telefone: telefone || null,
      valor,
      descricao,
      status: "pendente",
      link_url: link || null,
      pix_copia_cola: copia || null,
      qr_base64: qr64 || null,
      provider_payment_id: String(pay.id),
      external_ref: ref,
      defcon_client_id: clientId,
      abate_calote: abate,
      data: brDate(new Date()),
      expira_em: pay?.date_of_expiration ?? null,
    }).select("id").maybeSingle();

    if (errIns) {
      console.error("cobranca-criar insert", errIns.message);
      return json({ error: "erro_interno" }, 500);
    }

    return json({
      ok: true,
      id: (cob as any)?.id ?? null,
      link,
      copia_cola: copia,
      qr_base64: qr64,
      expira_em: pay?.date_of_expiration ?? null,
    });
  } catch (e) {
    console.error("cobranca-criar", e);
    return new Response(JSON.stringify({ error: "erro_interno" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
