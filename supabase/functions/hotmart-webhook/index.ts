import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hotmart-hottok",
};

type Cliente = ReturnType<typeof createClient>;

const criarClienteServidor = (): Cliente =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// RECEBIDO ≠ CONCLUÍDO (12/10/2026): o evento é marcado em processed_hotmart_events
// logo no início (trava contra a Hotmart reenviar no meio). Se QUALQUER gravação que
// libera ou tira acesso falhar depois, a marca é apagada e a resposta é 500 — assim a
// Hotmart reenvia e o reenvio é processado de novo, em vez de cair em "duplicado".
// Reprocessar é seguro: as gravações usam valores absolutos (upsert por user_id,
// pro_conceder/banco_extra_registrar fazem upsert).
class FalhaGravacao extends Error {
  constructor(public etapa: string, causa: unknown) {
    super(`${etapa}: ${(causa as { message?: string })?.message ?? String(causa)}`.slice(0, 300));
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lança FalhaGravacao se a chamada ao Supabase devolveu { error }. */
function exigir(etapa: string, r: { error: unknown }) {
  if (r.error) throw new FalhaGravacao(etapa, r.error);
}

export async function tratarHotmart(req: Request, criarCliente: () => Cliente = criarClienteServidor): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let supabase: Cliente | null = null;
  let eventoMarcado: string | null = null;
  try {
    // Validate Hotmart hottok
    const hottok = req.headers.get("x-hotmart-hottok");
    const expectedHottok = Deno.env.get("HOTMART_HOTTOK");

    // FAIL-CLOSED: sem o segredo configurado OU com hottok inválido, rejeita.
    if (!expectedHottok || hottok !== expectedHottok) {
      console.error("hotmart-webhook: hottok inválido ou HOTMART_HOTTOK ausente — rejeitado");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const payload = await req.json();
    console.log("Hotmart event received:", JSON.stringify(payload).slice(0, 500));

    const event = payload.event || payload.data?.event;
    const buyerEmail = payload.data?.buyer?.email || payload.buyer?.email;
    const buyerDoc = payload.data?.buyer?.document || payload.buyer?.document;
    const purchaseId = payload.data?.purchase?.transaction || payload.purchase?.transaction || "";
    const subscriptionId = payload.data?.subscription?.subscriber?.code || "";

    // ===== ORIGEM E DINHEIRO DA VENDA (23/08/2026) =====
    // A Hotmart manda quem indicou e quanto entrou — e a gente ignorava tudo isso.
    // Sem esses campos era impossível auditar comissão de afiliado: o painel só
    // conseguia atribuir venda por e-mail de lead, e quem comprou por link de
    // afiliado DA HOTMART não aparecia pra ninguém.
    const compra = payload.data?.purchase ?? payload.purchase ?? {};
    const afiliados = payload.data?.affiliates ?? payload.affiliates ?? [];
    const afiliado = Array.isArray(afiliados) && afiliados.length > 0 ? afiliados[0] : null;
    const afiliadoNome = afiliado?.name ?? afiliado?.affiliate_name ?? null;
    const afiliadoCodigo = afiliado?.affiliate_code ?? afiliado?.code ?? null;
    const origemSrc =
      compra?.origin?.src ?? compra?.origin?.sck ?? compra?.origin?.xcod ??
      compra?.sck ?? compra?.src ?? null;
    // CUPOM DO PARCEIRO (12/09/2026): quando a pessoa compra pelo link do influenciador,
    // a Hotmart aplica um cupom e manda o NOME dele na oferta (ex: offer.name = "ZECK5").
    // Essa é a prova mais forte de quem fez a venda — vale mais que o e-mail do formulário,
    // porque não depende de a pessoa assinar com o mesmo e-mail que cadastrou.
    const cupomOferta = (compra?.offer?.name ?? "").toString().trim().toUpperCase() || null;
    const valorVenda =
      compra?.price?.value ?? compra?.full_price?.value ?? compra?.offer?.price?.value ?? null;
    const moedaVenda =
      compra?.price?.currency_value ?? compra?.price?.currency_code ??
      compra?.full_price?.currency_value ?? null;
    const buyerNome = payload.data?.buyer?.name ?? payload.buyer?.name ?? null;

    // Clean CPF (remove non-digits)
    const buyerCpf = buyerDoc ? buyerDoc.replace(/\D/g, "") : null;

    supabase = criarCliente();

    // IDEMPOTENCIA: a Hotmart reenvia o mesmo evento em timeout/erro. Registra o evento;
    // se ja foi processado, ignora (evita estender assinatura 2x ou ressuscitar cancelada).
    const eventId = String(
      payload.id ??
        payload.data?.id ??
        `${purchaseId}:${event}:${payload.creation_date ?? payload.data?.purchase?.approved_date ?? ""}`
    );
    const { error: dupErr } = await supabase
      .from("processed_hotmart_events")
      .insert({ event_id: eventId, event_type: event, purchase_id: purchaseId });
    if (dupErr) {
      if ((dupErr as { code?: string }).code === "23505") {
        console.log("hotmart-webhook: evento duplicado ignorado", eventId);
        return new Response(JSON.stringify({ status: "duplicate" }), { headers: corsHeaders });
      }
      console.error("hotmart-webhook: dedup falhou (seguindo)", (dupErr as { message?: string }).message);
    } else {
      eventoMarcado = eventId;
    }

    // ===== CAIXA-PRETA DA VENDA =====
    // Guarda o evento INTEIRO antes de processar. Se o processamento falhar depois,
    // o dado não se perde — dá pra reprocessar na mão. E é isso que permite auditar
    // comissão: origem, afiliado e valor de cada venda ficam registrados pra sempre.
    let ehRenovacao: boolean | null = null;
    try {
      if (buyerEmail || buyerCpf) {
        const { data: jaExiste } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("hotmart_subscription_id", subscriptionId)
          .maybeSingle();
        ehRenovacao = subscriptionId ? !!jaExiste : null;
      }
    } catch { /* renovação é informativo — nunca derruba o webhook */ }

    // BUSCA UNIFICADA (v16): orbis_achar_usuario acha o dono por CPF (perfil) e por
    // E-MAIL sem diferenciar maiúsculas — no perfil E no e-mail de LOGIN (auth.users).
    // Antes era .eq("email", ...) só no perfil: "Fulano@Gmail.com" na Hotmart não
    // casava com "fulano@gmail.com" no app, e quem se cadastrou por CPF (sem e-mail
    // no perfil) nunca era encontrado.
    let userId: string | null = null;
    try {
      const { data: achado, error: achadoErr } = await supabase.rpc("orbis_achar_usuario", {
        p_email: buyerEmail ?? "",
        p_cpf: buyerCpf ?? "",
      });
      if (achadoErr) console.error("orbis_achar_usuario erro:", achadoErr.message);
      if (achado) userId = String(achado);
    } catch (e) {
      console.error("orbis_achar_usuario exceção:", String(e).slice(0, 200));
    }

    // FALLBACK PELO XCOD (13/10/2026): todo link de checkout do app leva xcod=<user id>.
    // Se a pessoa digitou outro e-mail/CPF na Hotmart, o xcod ainda aponta pra conta.
    // Só vale se for um UUID de um perfil que existe.
    if (!userId) {
      const xcod = String(
        compra?.origin?.xcod ?? compra?.xcod ?? payload.purchase?.origin?.xcod ?? "",
      ).trim();
      if (UUID_RE.test(xcod)) {
        // Erro na busca NÃO pode virar "compra sem dono": falha e a Hotmart reenvia.
        const r = await supabase
          .from("profiles")
          .select("user_id")
          .eq("user_id", xcod)
          .maybeSingle();
        exigir("busca pelo xcod", r);
        const achadoXcod = (r.data as { user_id?: string } | null)?.user_id;
        if (achadoXcod) {
          userId = String(achadoXcod);
          console.log("achado pelo xcod");
        }
      }
    }

    // Grava a caixa-preta agora que já sabemos de quem é (userId pode ser null).
    try {
      await supabase.from("hotmart_eventos").insert({
        event_id: eventId,
        event_type: event,
        purchase_id: purchaseId,
        subscription_id: subscriptionId,
        buyer_email: buyerEmail || null,
        buyer_cpf: buyerCpf || null,
        buyer_nome: buyerNome,
        valor: valorVenda,
        moeda: moedaVenda,
        afiliado_nome: afiliadoNome,
        afiliado_codigo: afiliadoCodigo,
        origem_src: origemSrc,
        eh_renovacao: ehRenovacao,
        user_id: userId,
        payload,
      });
    } catch (e) {
      console.error("hotmart_eventos: falhou ao registrar (seguindo)", String(e).slice(0, 200));
    }

    // CARIMBO DA ORIGEM: se a venda veio com cupom de parceiro e o perfil ainda não tem
    // origem, grava agora. O carimbo é permanente (só preenche quando está vazio), então
    // nunca rouba uma venda de outro parceiro.
    if (userId && cupomOferta) {
      try {
        const { data: parceiro } = await supabase
          .from("parceiros")
          .select("code")
          .ilike("code", cupomOferta)
          .maybeSingle();
        if (parceiro?.code) {
          await supabase
            .from("profiles")
            .update({ origem_ref: parceiro.code, origem_fixada_em: new Date().toISOString() })
            .eq("user_id", userId)
            .is("origem_ref", null);
        }
      } catch (e) {
        console.error("carimbo de origem falhou (seguindo)", String(e).slice(0, 200));
      }
    }

    // BANCO EXTRA (03/10/2026): oferta 3nnrr1xn (R$ 12,90, desde 06/10) e a antiga otgozkn9
    // (R$ 10, mantida pras contas de cortesia), do mesmo produto.
    // Trilho próprio e SAI ANTES de tudo: não pode renovar nem cancelar a
    // assinatura principal (uma compra de R$ 10 não estende o plano cheio, e
    // cancelar o banco extra não derruba o app). Cada assinatura ativa = 1 vaga.
    // O cancelamento de assinatura chega SEM a oferta (só o código do assinante,
    // em data.subscriber.code): se esse código é de um banco extra — e não da
    // assinatura principal — também cai aqui.
    const BANCO_EXTRA_OFFERS = new Set(["3nnrr1xn", "otgozkn9"]);
    const assinanteCod = String(payload.data?.subscription?.subscriber?.code || payload.data?.subscriber?.code || "");
    const evBx = String(event || "").toUpperCase();
    let bxDono: string | null = null;
    let ehBancoExtra = BANCO_EXTRA_OFFERS.has(String(compra?.offer?.code ?? "").trim());
    if (!ehBancoExtra && assinanteCod && evBx.includes("CANCELLATION")) {
      const [{ data: bx }, { data: principal }] = await Promise.all([
        supabase.from("bancos_extra_compras").select("user_id").eq("chave", assinanteCod).maybeSingle(),
        supabase.from("subscriptions").select("id").eq("hotmart_subscription_id", assinanteCod).maybeSingle(),
      ]);
      if (bx?.user_id && !principal) { ehBancoExtra = true; bxDono = String(bx.user_id); }
    }
    if (ehBancoExtra) {
      const liga = evBx.includes("PURCHASE_APPROVED") || evBx.includes("PURCHASE_COMPLETE") || evBx.includes("SUBSCRIPTION_RENEWAL");
      const desliga = evBx.includes("SUBSCRIPTION_CANCELLATION") || evBx.includes("PURCHASE_REFUNDED") || evBx.includes("PURCHASE_CHARGEBACK");
      const dono = userId ?? bxDono;
      if (!dono) {
        // fica na caixa-preta (hotmart_eventos); NÃO vai pra unlinked_purchases,
        // senão o cadastro reivindicaria como se fosse a assinatura principal
        console.error("banco extra: comprador não identificado — liberar à mão", buyerEmail);
        return new Response(JSON.stringify({ status: "banco_extra_sem_dono" }), { headers: corsHeaders });
      }
      if (liga || desliga) {
        const ate = new Date();
        ate.setDate(ate.getDate() + 33); // 30 dias + 3 de tolerância
        const { error: bxErr } = await supabase.rpc("banco_extra_registrar", {
          p_user: dono, p_chave: assinanteCod || purchaseId, p_ativo: liga, p_ate: ate.toISOString(),
        });
        exigir("banco_extra_registrar", { error: bxErr });
        console.log(`Banco extra ${liga ? "liberado" : "retirado"} para ${dono}`);

        // BUG-005 (08/10/2026): a compra caiu numa conta que NÃO consegue usar o banco
        // (teste expirado, sem cortesia, sem Pro) — típico de cadastro duplicado: a
        // Hotmart casou pelo CPF com a conta velha, e a pessoa usa outra. Antes isso
        // passava em silêncio como "banco_extra_ok". Agora grava em unlinked_purchases
        // (a lista de pendências do admin) e grita no log, sem desfazer a liberação.
        if (liga) {
          try {
            const { data: podeUsar } = await supabase.rpc("orbis_pro_ativo", { p_user: dono });
            const { data: perfil } = await supabase.from("profiles")
              .select("plan_status, billing_exempt").eq("user_id", dono).maybeSingle();
            const contaMorta = perfil && perfil.plan_status === "expired" && !perfil.billing_exempt && podeUsar !== true;
            if (contaMorta) {
              console.error(`BANCO_EXTRA_EM_CONTA_EXPIRADA user=${dono} cpf=${buyerCpf ?? "?"} email=${buyerEmail ?? "?"} — provável cadastro duplicado; conferir no admin`);
              await supabase.from("unlinked_purchases").insert({
                buyer_email: buyerEmail || null, buyer_cpf: buyerCpf || null,
                hotmart_purchase_id: purchaseId, hotmart_subscription_id: subscriptionId,
                event_type: `${event}:BANCO_EXTRA_CONTA_EXPIRADA`, payload,
                linked_at: new Date().toISOString(), linked_to_user_id: dono,
              });
            }
          } catch (e) {
            console.error("checagem conta expirada falhou (seguindo)", String(e).slice(0, 200));
          }
        }
      }
      return new Response(JSON.stringify({ status: "banco_extra_ok" }), { headers: corsHeaders });
    }

    // If can't identify user, store as unlinked.
    // NÃO é beco sem saída: o gatilho trg_reivindicar_compras (profiles) reivindica
    // esta compra automaticamente quando a pessoa se cadastrar com o mesmo
    // e-mail/CPF — ela já entra como pagante, sem ninguém precisar mexer.
    if (!userId) {
      console.log("Could not identify user, storing as unlinked purchase");
      exigir("unlinked_purchases", await supabase.from("unlinked_purchases").insert({
        buyer_email: buyerEmail || null,
        buyer_cpf: buyerCpf || null,
        hotmart_purchase_id: purchaseId,
        hotmart_subscription_id: subscriptionId,
        event_type: event,
        payload,
      }));
      return new Response(JSON.stringify({ status: "unlinked" }), {
        headers: corsHeaders,
      });
    }

    // VANT PRO (02/10/2026): the Pro plans are OFFERS of this same product, so they
    // land here, not in hotmart-pro. offer.code tells them apart. Annual pays once a
    // year: its period must be 365 days, or the buyer is locked out after a month.
    // Planos 06/10/2026: anual novo ew11enu0 (R$ 418,80, 2 bancos); o 6vkxbh8c segue valendo pra quem já assinou.
    const PRO_OFFERS: Record<string, number> = { "5y86n311": 30, "6vkxbh8c": 365, "ew11enu0": 365 };
    const offerCode = String(compra?.offer?.code ?? "").trim();
    const proDays = PRO_OFFERS[offerCode] ?? null;

    // Calculate period end (30 days from now as default for monthly)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + (proDays ?? 30));
    const graceEnd = new Date(periodEnd);
    graceEnd.setDate(graceEnd.getDate() + 3);

    // Handle events
    const eventNormalized = (event || "").toUpperCase();

    if (
      eventNormalized.includes("PURCHASE_APPROVED") ||
      eventNormalized.includes("PURCHASE_COMPLETE") ||
      eventNormalized.includes("SUBSCRIPTION_RENEWAL")
    ) {
      // Activate subscription
      exigir("subscriptions", await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            provider: "hotmart",
            status: "active",
            current_period_end: periodEnd.toISOString(),
            grace_until: graceEnd.toISOString(),
            hotmart_purchase_id: purchaseId,
            hotmart_subscription_id: subscriptionId,
            last_event_at: now.toISOString(),
          },
          { onConflict: "user_id" }
        ));

      // Update profile plan_status
      exigir("profiles", await supabase
        .from("profiles")
        .update({ plan_status: "active", is_trial_active: false })
        .eq("user_id", userId));

      if (proDays) {
        const { error: proErr } = await supabase.rpc("pro_conceder", {
          p_user: userId, p_origem: "hotmart",
          p_codigo: subscriptionId || null, p_produto: offerCode,
          p_ate: graceEnd.toISOString(),
        });
        exigir("pro_conceder", { error: proErr });
        console.log(`Vant Pro (${offerCode}) on for user ${userId}`);
      }

      console.log(`Subscription activated for user ${userId}`);
    } else if (
      eventNormalized.includes("PURCHASE_DELAYED") ||
      eventNormalized.includes("PURCHASE_PROTEST")
    ) {
      // Past due
      exigir("subscriptions", await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            provider: "hotmart",
            status: "past_due",
            hotmart_purchase_id: purchaseId,
            hotmart_subscription_id: subscriptionId,
            last_event_at: now.toISOString(),
          },
          { onConflict: "user_id" }
        ));

      console.log(`Subscription past_due for user ${userId}`);
    } else if (
      eventNormalized.includes("SUBSCRIPTION_CANCELLATION") ||
      eventNormalized.includes("PURCHASE_REFUNDED") ||
      eventNormalized.includes("PURCHASE_CHARGEBACK")
    ) {
      // Cancel immediately
      exigir("subscriptions", await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            provider: "hotmart",
            status: "canceled",
            grace_until: now.toISOString(), // Block immediately
            hotmart_purchase_id: purchaseId,
            hotmart_subscription_id: subscriptionId,
            last_event_at: now.toISOString(),
          },
          { onConflict: "user_id" }
        ));

      exigir("profiles", await supabase
        .from("profiles")
        .update({ plan_status: "expired" })
        .eq("user_id", userId));

      if (proDays) {
        const { error: proErr } = await supabase.rpc("pro_revogar", { p_user: userId });
        exigir("pro_revogar", { error: proErr });
      }

      console.log(`Subscription canceled for user ${userId}`);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Webhook error:", error instanceof Error ? error.message : String(error).slice(0, 300));
    // Não concluiu: libera o evento pra Hotmart reenviar (senão o reenvio vira "duplicado").
    if (supabase && eventoMarcado) {
      const { error: libErr } = await supabase.from("processed_hotmart_events").delete().eq("event_id", eventoMarcado);
      if (libErr) console.error(`hotmart-webhook: NÃO liberou o evento ${eventoMarcado} pra reenvio — reprocessar à mão`, libErr.message);
    }
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

Deno.serve((req) => tratarHotmart(req));
