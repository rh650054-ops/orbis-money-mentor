/* "Gerar Pix" (Rick, 26/11/2026): a payment whose transaction VANT itself asked Hotmart for
   (hotmart_negociacoes.transacao). Pure rules (tested). The transaction code is the proof that
   links the payment to the account, the subscription and the recurrence it was generated for —
   never the buyer's e-mail, never the subscription status (it may stay "overdue" after paying). */

export interface Negociacao { id: string; user_id: string; assinatura: string; recorrencia: number; proxima_cobranca: string | null; status: string }
export type DecisaoNegociacao =
  | { acao: "liberar"; fim: string }
  | { acao: "pago_sem_prazo" }
  | { acao: "ja_paga" }
  | { acao: "divergente"; motivo: "assinatura" | "recorrencia" };

/** Until when does a paid negotiation give access? The subscription's own next charge: the one in
    the payment event, else the one read when the Pix was generated. Never "now + 30 days": paying
    an OLD recurrence does not open a new month. null = no proven date. */
export function fimDoAcessoNegociado(proximaNoEvento: unknown, proximaGuardada: string | null | undefined, agora = new Date()): string | null {
  for (const ms of [Number(proximaNoEvento), proximaGuardada ? Date.parse(proximaGuardada) : NaN]) {
    if (Number.isFinite(ms) && ms > agora.getTime() && ms < agora.getTime() + 400 * 86_400_000) return new Date(ms).toISOString();
  }
  return null;
}

export function decidirNegociacao(neg: Negociacao, evento: { assinatura?: string | null; recorrencia?: unknown; proxima?: unknown }, agora = new Date()): DecisaoNegociacao {
  // APPROVED and, days later, COMPLETE carry the same transaction: the second one changes nothing
  if (neg.status === "pago") return { acao: "ja_paga" };
  // what the event says must agree with what the Pix was generated for
  if (evento.assinatura && evento.assinatura !== neg.assinatura) return { acao: "divergente", motivo: "assinatura" };
  const rec = Number(evento.recorrencia);
  if (evento.recorrencia !== undefined && evento.recorrencia !== null && Number.isFinite(rec) && rec !== neg.recorrencia) return { acao: "divergente", motivo: "recorrencia" };
  const fim = fimDoAcessoNegociado(evento.proxima, neg.proxima_cobranca, agora);
  return fim ? { acao: "liberar", fim } : { acao: "pago_sem_prazo" };
}
