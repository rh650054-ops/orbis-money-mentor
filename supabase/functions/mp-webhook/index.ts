// Orbis — mp-webhook: o Mercado Pago chama aqui quando um pagamento acontece.
// Três engrenagens:
//   A) DEPÓSITO na carteira X1 (pagamento na conta do Orbis) → credita o saldo.
//   B) VENDA de um vendedor CONECTADO (Mercado Pago Connect) → grava em mp_vendas
//      pra ele lançar no DEFCON com um toque.
//   C) COBRANÇA do cobrador de calote (tem external_reference nosso) → dá baixa
//      sozinha: marca a cobranca como paga e abate o calote do dia.
// SEGURANÇA: nunca confiamos no corpo da notificação — pegamos só o ID e
// RE-CONSULTAMOS o pagamento na API do MP com o token certo. Crédito e baixa são
// idempotentes (só acontecem uma vez).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const brDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const ok = () => new Response("ok", { status: 200 });

Deno.serve(async (req) => {
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const url = new URL(req.url);
    let id = url.searchParams.get("data.id") || url.searchParams.get("id") || "";
    let userIdMp = url.searchParams.get("user_id") || "";
    try {
      const body = await req.json();
      id = String(body?.data?.id ?? body?.id ?? id ?? "");
      userIdMp = String(body?.user_id ?? userIdMp ?? "");
    } catch { /* sem corpo */ }
    if (!id) return ok();

    // ---- de quem é esse pagamento? se for de uma conta conectada, usa o token dela
    let con: any = null;
    if (userIdMp) {
      const { data } = await admin.from("mp_conexoes").select("*").eq("mp_user_id", String(userIdMp)).eq("ativo", true).maybeSingle();
      con = data;
    }
    const token = con?.access_token ?? Deno.env.get("MP_ACCESS_TOKEN");
    if (!token) return ok();

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return ok();
    const pay = await r.json();
    if (pay?.status !== "approved") return ok();

    // ---- B) venda de vendedor conectado
    if (con) {
      const pago = pay?.date_approved ?? pay?.date_created;
      const poi = String(pay?.point_of_interaction?.type ?? "").toLowerCase();
      const valor = Number(pay?.transaction_amount) || 0;
      const ref = String(pay?.external_reference ?? "").trim();

      if (pago && valor > 0) {
        await admin.from("mp_vendas").upsert({
          payment_id: String(pay.id),
          user_id: con.user_id,
          valor,
          liquido: Number(pay?.transaction_details?.net_received_amount) || null,
          metodo: String(pay?.payment_method_id ?? pay?.payment_type_id ?? ""),
          origem: poi.includes("point") ? "point" : poi.includes("qr") ? "qr" : poi.includes("link") ? "link" : "outro",
          status: "approved",
          descricao: String(pay?.description ?? "").slice(0, 120),
          pago_em: pago,
          data: brDate(pago),
        }, { onConflict: "payment_id", ignoreDuplicates: true });
      }

      // ---- C) era uma COBRANÇA do Orbis? dá baixa no calote sozinha.
      if (ref) {
        const { data: cob } = await admin.from("cobrancas")
          .select("id, user_id, lancada")
          .eq("external_ref", ref)
          .eq("user_id", con.user_id)
          .maybeSingle();

        if (cob && !(cob as any).lancada) {
          const { error: eRpc } = await admin.rpc("cobranca_registrar_paga", {
            p_id: (cob as any).id,
            p_valor: valor,
            p_pago_em: pago,
            p_payment_id: String(pay.id),
          });
          if (eRpc) console.error("mp-webhook cobranca baixa", eRpc.message);
        }

        // a cobrança JÁ entrou no dia do vendedor. Marcar como lançada evita
        // que ela apareça de novo na lista de "vendas pra lançar" e conte em dobro.
        if (cob) {
          await admin.from("mp_vendas")
            .update({ lancado: true })
            .eq("payment_id", String(pay.id));
        }
      }
      return ok();
    }

    // ---- A) depósito na carteira X1 (conta do Orbis)
    const { data: upd } = await admin
      .from("x1_mp_payments")
      .update({ status: "creditado", credited_at: new Date().toISOString() })
      .eq("payment_id", String(id))
      .eq("status", "aguardando")
      .select("user_id, valor")
      .maybeSingle();
    if (!upd) return ok(); // já creditado, ou não é nosso

    const { error } = await admin.rpc("x1_wallet_apply", {
      p_user: (upd as any).user_id,
      p_amount: (upd as any).valor,
      p_tipo: "deposito",
      p_x1: null,
      p_notes: `Deposito Pix automatico (MP ${String(id).slice(0, 12)})`,
      p_by: null,
    });
    if (error) {
      console.error("mp-webhook credito erro", error.message);
      await admin.from("x1_mp_payments").update({ status: "aguardando", credited_at: null }).eq("payment_id", String(id));
    }
    return ok();
  } catch (e) {
    console.error("mp-webhook excecao", e);
    return ok();
  }
});
