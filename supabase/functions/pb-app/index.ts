// Orbis — pb-app: cria (ou reconsulta) a APLICAÇÃO Connect do Orbis no PagBank.
//
// Por que existe: no PagBank a aplicação não nasce num painel — nasce de uma
// chamada de API autenticada com o token da conta. Em vez do Rick copiar
// client_id e client_secret na mão (e esses segredos passearem por tela, chat e
// área de transferência), esta função faz a chamada no servidor e guarda o
// resultado direto em public.pb_aplicacao — tabela sem nenhuma policy de RLS,
// ou seja, invisível pra qualquer usuário logado.
//
// A resposta NUNCA devolve o segredo: só diz o que chegou e se foi salvo.
//
// Duas portas de entrada, as duas de administrador:
//   1) POST com o login de um admin do Orbis  → { acao: 'ver' | 'criar' }
//   2) GET  ?nonce=...  → senha de uso único criada direto no banco (instalação).
//      O nonce vale UMA vez e por 15 minutos. Nenhum segredo vai na URL.
//
// verify_jwt=false porque a conferência é feita aqui dentro (as duas portas).
//
// Pré-requisito: PB_TOKEN e PB_AMBIENTE nos Secrets do Supabase — nunca no chat.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REDIRECT = "https://app.orbis.inf.br/pb/retorno";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const URL_SUPA = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(URL_SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const url = new URL(req.url);
    const nonce = url.searchParams.get("nonce") ?? "";
    let acao = url.searchParams.get("acao") ?? "";
    let liberado = false;

    // ---- porta 2: senha de uso único criada no banco
    if (nonce) {
      const { data: n } = await admin.from("setup_nonces")
        .select("nonce, para, criado_em, usado_em").eq("nonce", nonce).maybeSingle();
      const valido = !!n && (n as any).para === "pb-app" && !(n as any).usado_em
        && Date.now() - new Date((n as any).criado_em).getTime() < 15 * 60_000;
      if (!valido) return json({ error: "nonce_invalido" }, 403);
      await admin.from("setup_nonces").update({ usado_em: new Date().toISOString() }).eq("nonce", nonce);
      liberado = true;
      if (!acao) acao = "criar";
    }

    // ---- porta 1: login de admin do Orbis
    if (!liberado) {
      const supa = createClient(URL_SUPA, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: u } = await supa.auth.getUser();
      if (!u?.user?.id) return json({ error: "sem_login" }, 401);
      const { data: ehAdmin } = await supa.rpc("is_orbis_admin");
      if (ehAdmin !== true) return json({ error: "so_admin" }, 403);
      liberado = true;
      const body = await req.json().catch(() => ({} as any));
      acao = String(body?.acao ?? acao ?? "ver");
    }

    const ambiente = (Deno.env.get("PB_AMBIENTE") ?? "sandbox") === "producao" ? "producao" : "sandbox";
    const apiBase = ambiente === "producao" ? "https://api.pagseguro.com" : "https://sandbox.api.pagseguro.com";

    const { data: atual } = await admin.from("pb_aplicacao").select("*").eq("id", "orbis").maybeSingle();

    if (acao === "ver") {
      return json({
        ok: true,
        ambiente,
        tem_token: !!Deno.env.get("PB_TOKEN"),
        tem_aplicacao: !!atual,
        tem_client_id: !!(atual as any)?.client_id,
        tem_client_secret: !!(atual as any)?.client_secret,
        redirect_uri: (atual as any)?.redirect_uri ?? null,
      });
    }

    if (acao !== "criar") return json({ error: "acao_invalida" }, 400);

    const token = Deno.env.get("PB_TOKEN");
    if (!token) return json({ error: "sem_pb_token", dica: "Cole PB_TOKEN nos Secrets do Supabase." });

    const r = await fetch(`${apiBase}/oauth2/application`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: "Orbis",
        description: "Gestao de vendas para vendedores autonomos",
        site: "https://app.orbis.inf.br",
        redirect_uri: REDIRECT,
      }),
      signal: AbortSignal.timeout(25000),
    });

    const texto = await r.text();
    let resp: any = {};
    try { resp = JSON.parse(texto); } catch { resp = {}; }

    if (!r.ok) {
      console.error("pb-app criar erro", r.status, texto.slice(0, 400));
      return json({
        error: "pagbank_recusou",
        http: r.status,
        // mensagem do PagBank ajuda a diagnosticar e não contém segredo
        detalhe: String(
          resp?.error_messages?.[0]?.description ??
          resp?.error_messages?.[0]?.code ??
          resp?.message ?? texto
        ).slice(0, 300),
      });
    }

    // o PagBank pode nomear os campos de formas diferentes conforme a versão;
    // pegamos o que existir e guardamos o corpo inteiro pra não perder nada.
    const clientId = resp?.client_id ?? resp?.clientId ?? resp?.id ?? null;
    const clientSecret = resp?.client_secret ?? resp?.clientSecret ?? resp?.secret ?? null;
    const accountId = resp?.account_id ?? resp?.accountId ?? null;

    await admin.from("pb_aplicacao").upsert({
      id: "orbis",
      ambiente,
      client_id: clientId,
      client_secret: clientSecret,
      account_id: accountId,
      redirect_uri: REDIRECT,
      bruto: resp,
      atualizada_em: new Date().toISOString(),
    });

    return json({
      ok: true,
      ambiente,
      salvou_client_id: !!clientId,
      salvou_client_secret: !!clientSecret,
      salvou_account_id: !!accountId,
      // só os NOMES dos campos que vieram — nenhum valor
      campos: Object.keys(resp ?? {}),
    });
  } catch (e) {
    console.error("pb-app", e);
    return json({ error: "erro_interno" }, 500);
  }
});
