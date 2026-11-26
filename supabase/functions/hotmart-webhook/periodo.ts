/** 04/11 (Rick): the due day is fixed — the paid period ends on Hotmart's own next charge date
    (data.purchase.date_next_charge, ms). Fallback when it's missing or absurd: now + plan days. */
export function fimDoPeriodo(proximaCobranca: unknown, diasDoPlano: number, agora: Date = new Date()): Date {
  const ms = Number(proximaCobranca);
  const limite = agora.getTime() + 400 * 86_400_000;
  if (Number.isFinite(ms) && ms > agora.getTime() && ms < limite) return new Date(ms);
  const fim = new Date(agora);
  fim.setDate(fim.getDate() + diasDoPlano);
  return fim;
}

/** 26/11 (Rick): may this approved payment open a period on its own, and until when?
    A normal charge brings the subscriber code AND Hotmart's next charge in the future (all 545
    payment events until 26/11 do): the period ends on that date. Without them, only a FIRST charge
    (recurrence 1) keeps the old fallback (now + plan days). An older recurrence paid late, or a
    payment with no subscription attached, proves no new period: null → nothing is released by
    this event alone (the negotiation link or "Já paguei, verificar" decides). */
export function fimDoPagamento(p: { proximaCobranca: unknown; recorrencia: unknown; assinatura: string | null | undefined; diasDoPlano: number }, agora: Date = new Date()): Date | null {
  const ms = Number(p.proximaCobranca);
  const futura = Number.isFinite(ms) && ms > agora.getTime() && ms < agora.getTime() + 400 * 86_400_000;
  if (futura && p.assinatura) return new Date(ms);
  if (Number(p.recorrencia) === 1) return fimDoPeriodo(p.proximaCobranca, p.diasDoPlano, agora);
  return null;
}

/** Subscription code of the event. Cancellations carry it in data.subscriber.code, not in
    data.subscription.subscriber.code — reading only the second left 32 of 57 cancellations unidentified. */
export function codigoDaAssinatura(payload: { data?: Record<string, unknown> } | null | undefined): string {
  const d = (payload?.data ?? {}) as { subscription?: { subscriber?: { code?: unknown } }; subscriber?: { code?: unknown } };
  return String(d.subscription?.subscriber?.code || d.subscriber?.code || "").trim();
}
