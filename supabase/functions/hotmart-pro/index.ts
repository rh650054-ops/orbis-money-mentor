// Vant — hotmart-pro: webhook DEDICADO do produto "Vant Pro" (+R$ 10/mes).
//
// Por que separado do hotmart-webhook: aquele ja funciona e mexe na assinatura
// principal (R$ 29,90). Se o Pro entrasse por la, uma compra de R$ 10 renovaria
// o plano cheio de graca. Na Hotmart da pra apontar um webhook POR PRODUTO —
// entao o Pro tem trilho proprio e o que esta no ar nao corre risco nenhum.
//
// O que ele faz: aprovou/renovou → liga o Pro. Cancelou/estornou → desliga.
// O SELO nunca e retirado aqui: ele foi conquistado por uma conta bancaria que
// existiu de verdade, e tirar selo de quem ja provou queima confianca.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    // FAIL-CLOSED: sem o segredo configurado, ou com hottok errado, rejeita.
    const hottok = req.headers.get("x-hotmart-hottok");
    const esperado = Deno.env.get("HOTMART_HOTTOK");
    if (!esperado || hottok !== esperado) {
      console.error("hotmart-pro: hottok invalido ou ausente — rejeitado");
      return json({ error: "unauthorized" }, 401);
    }

    const payload = await req.json().catch(() => ({} as any));
    const evento = String(payload?.event ?? payload?.data?.event ?? "").toUpperCase();
    const email = payload?.data?.buyer?.email ?? payload?.buyer?.email ?? "";
    const doc = payload?.data?.buyer?.document ?? payload?.buyer?.document ?? "";
    const cpf = doc ? String(doc).replace(/\D/g, "") : "";
    const assinante = String(payload?.data?.subscription?.subscriber?.code ?? "");
    const produto = String(payload?.data?.product?.id ?? payload?.product?.id ?? "");
    const compra = String(payload?.data?.purchase?.transaction ?? payload?.purchase?.transaction ?? "");

    console.log("hotmart-pro", evento, "produto", produto);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // IDEMPOTENCIA: a Hotmart reenvia o mesmo evento em timeout. Se ja processamos, sai.
    const eventoId = String(
      payload?.id ?? payload?.data?.id ?? `${compra}:${evento}:${payload?.creation_date ?? ""}`
    );
    const { error: dupErr } = await admin.from("processed_hotmart_events")
      .insert({ event_id: eventoId, event_type: `PRO_${evento}`, purchase_id: compra });
    if (dupErr && (dupErr as any).code === "23505") {
      console.log("hotmart-pro: evento duplicado ignorado", eventoId);
      return json({ status: "duplicate" });
    }

    // de quem e a compra? (mesma busca do webhook principal: e-mail OU CPF)
    let userId: string | null = null;
    const { data: achado, error: eAchar } = await admin.rpc("orbis_achar_usuario", {
      p_email: email ?? "", p_cpf: cpf ?? "",
    });
    if (eAchar) console.error("orbis_achar_usuario:", eAchar.message);
    if (achado) userId = String(achado);

    if (!userId) {
      // ninguem cadastrado com esse e-mail/CPF ainda — guarda pra reivindicar depois
      console.log("hotmart-pro: comprador nao identificado, guardando");
      await admin.from("unlinked_purchases").insert({
        buyer_email: email || null, buyer_cpf: cpf || null,
        hotmart_purchase_id: compra, hotmart_subscription_id: assinante,
        event_type: `PRO_${evento}`, payload,
      });
      return json({ status: "unlinked" });
    }

    const ligou = evento.includes("PURCHASE_APPROVED") ||
      evento.includes("PURCHASE_COMPLETE") ||
      evento.includes("SUBSCRIPTION_RENEWAL");

    const desligou = evento.includes("CANCELLATION") ||
      evento.includes("REFUNDED") ||
      evento.includes("CHARGEBACK") ||
      evento.includes("EXPIRED");

    if (ligou) {
      const ate = new Date();
      ate.setDate(ate.getDate() + 33); // 30 dias + 3 de tolerância
      const { error } = await admin.rpc("pro_conceder", {
        p_user: userId, p_origem: "hotmart",
        p_codigo: assinante || null, p_produto: produto || null,
        p_ate: ate.toISOString(),
      });
      if (error) { console.error("pro_conceder:", error.message); return json({ error: "falhou" }, 500); }
      console.log("Vant Pro LIGADO para", userId);
      return json({ status: "pro_ativo" });
    }

    if (desligou) {
      const { error } = await admin.rpc("pro_revogar", { p_user: userId });
      if (error) { console.error("pro_revogar:", error.message); return json({ error: "falhou" }, 500); }
      console.log("Vant Pro DESLIGADO para", userId);
      return json({ status: "pro_cancelado" });
    }

    return json({ status: "ignorado", evento });
  } catch (e) {
    console.error("hotmart-pro", e);
    return json({ error: "erro_interno" }, 500);
  }
});
