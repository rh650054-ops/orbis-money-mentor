// Vant — apple-webhook. Receives the App Store Server Notifications (version 2): Apple calls it,
// with no session, whenever a subscription changes (renewal, refund, expiry, plan change...).
// verify_jwt = false in config.toml: the proof of who is calling is INSIDE the body.
//
//   1. AUTHENTICITY: the body is one JWS signed by Apple. Its certificate chain, signature, bundle id,
//      app id and environment are verified (verificador.ts), and so are the transaction and the
//      renewal info it carries. Anything else gets 401 and writes nothing.
//   2. IDEMPOTENCY: each notification has a notificationUUID. public.apple_evento_registrar answers
//      "novo", "pendente" (received before but never concluded: process again) or "repetido"
//      (already concluded: answer OK, do nothing). A failure after the receipt returns 500, so Apple
//      sends it again and it is processed again.
//   3. OWNER: the account Apple signed in the transaction (appAccountToken), or the account that
//      already owns the subscription. A notification never moves a subscription to another account:
//      when it carries another account's token, it is applied to the original owner (option B).
//   4. ORDER: the database keeps the status Apple signed LAST, whatever the arrival order.
//   5. STATE from the signed documents, not from the notification's name (regras.ts).
// Sandbox notifications are accepted and stored; they give access only to a registered test account.
// Never logs a JWS or a payload: only the technical identifiers.
import { aplicarEstado, chamar, type Banco } from "../_shared/apple/aplicar.ts";
import { donoPeloToken, ehAmbiente, linhaDeLog, type Notificacao, type Renovacao, type Transacao } from "../_shared/apple/regras.ts";
import { bancoDoServidor, json, verificadorDoServidor } from "../_shared/apple/servidor.ts";
import { AssinaturaInvalida, type Verificador } from "../_shared/apple/verificador.ts";

export interface Deps { verificar: Verificador; db: Banco }
let doServidor: Deps | null = null;
const depsDoServidor = (): Deps => (doServidor ??= { verificar: verificadorDoServidor(), db: bancoDoServidor() });

export async function tratarWebhook(req: Request, deps: Deps = depsDoServidor()): Promise<Response> {
  if (req.method !== "POST") return json({ error: "metodo" }, 405);
  const corpo = (await req.json().catch(() => null)) as { signedPayload?: unknown } | null;
  const assinado = corpo?.signedPayload;
  if (typeof assinado !== "string") return json({ error: "corpo_invalido" }, 400);

  // 1. authenticity of the notification and of what it carries
  let n: Notificacao, t: Transacao | null = null, r: Renovacao | null = null;
  try {
    n = await deps.verificar.notificacao(assinado);
    if (n.data?.signedTransactionInfo) t = await deps.verificar.transacao(n.data.signedTransactionInfo);
    if (n.data?.signedRenewalInfo) r = await deps.verificar.renovacao(n.data.signedRenewalInfo);
  } catch (e) {
    const retry = e instanceof AssinaturaInvalida && e.tentarDeNovo;
    console.warn("apple-webhook: signature refused", linhaDeLog({ resultado: e instanceof AssinaturaInvalida ? e.motivo : "FALHA" }));
    // 503: the revocation service did not answer, Apple should send it again. 401: not Apple's.
    return json({ error: retry ? "tente_de_novo" : "assinatura_invalida" }, retry ? 503 : 401);
  }
  const uuid = n.notificationUUID, tipo = n.notificationType;
  const ambiente = n.data?.environment ?? t?.environment;
  if (!uuid || !tipo) return json({ error: "notificacao_incompleta" }, 400);
  // the documents inside must be of the same environment as the notification that carries them
  if (t && n.data?.environment && t.environment !== n.data.environment) return json({ error: "assinatura_invalida" }, 401);

  const ids = { tipo, subtipo: n.subtype, uuid, original: t?.originalTransactionId, transacao: t?.transactionId, ambiente };
  try {
    // 2. idempotency (the JWS strings are not stored again: what they said is in `transacao` / `renovacao`)
    const dono = donoPeloToken(t);
    const recibo = await chamar<string>(deps.db, "apple_evento_registrar", {
      p_uuid: uuid, p_tipo: tipo, p_subtipo: n.subtype ?? null, p_ambiente: ehAmbiente(ambiente) ? ambiente : "Production",
      p_original: t?.originalTransactionId ?? null, p_user: dono, p_assinado: n.signedDate ? new Date(n.signedDate).toISOString() : null,
      p_payload: { notificacao: { ...n, data: n.data ? { ...n.data, signedTransactionInfo: undefined, signedRenewalInfo: undefined } : undefined }, transacao: t, renovacao: r },
      p_transacao: t?.transactionId ?? null,
    });
    if (recibo === "repetido") {
      console.log("apple-webhook: repeated", linhaDeLog({ ...ids, resultado: "repetido" }));
      return json({ ok: true, repetido: true });
    }

    // 3, 4, 5. owner, order and state are decided in the database from the signed documents
    let resultado = "sem_transacao";
    if (t && tipo !== "TEST") resultado = (await aplicarEstado(deps.db, dono, t, r, n.signedDate, false)).resultado;
    // 27/11/2026 (Rick, option B): a subscription stays with its ORIGINAL owner whatever VANT account
    // was open on the iPhone when the plan was changed. Apple then signs the next transactions with the
    // token of that other account; the token never moves the subscription, and the owner still gets
    // Apple's signed status (renewal, change, expiry) and the sale in the ledger. Same path as the
    // reconciliation (no account = the owner already stored). The other account gets nothing.
    if (t && resultado === "pertence_a_outra_conta") {
      const noDono = await aplicarEstado(deps.db, null, t, r, n.signedDate, false);
      resultado = noDono.resultado === "gravada" ? "gravada_no_dono" : noDono.resultado;
    }
    await chamar(deps.db, "apple_evento_concluir", { p_uuid: uuid, p_resultado: resultado });
    console.log("apple-webhook: event", linhaDeLog({ ...ids, resultado, user: dono }));
    return json({ ok: true, resultado });
  } catch (e) {
    // not concluded: Apple re-sends, and the next attempt finds it "pendente"
    console.error("apple-webhook: failed", linhaDeLog({ ...ids, resultado: e instanceof Error ? e.name : "erro" }));
    return json({ error: "falhou" }, 500);
  }
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") Deno.serve((req) => tratarWebhook(req));
