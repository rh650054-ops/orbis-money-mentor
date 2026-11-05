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

/** Subscription code of the event. Cancellations carry it in data.subscriber.code, not in
    data.subscription.subscriber.code — reading only the second left 32 of 57 cancellations unidentified. */
export function codigoDaAssinatura(payload: { data?: Record<string, unknown> } | null | undefined): string {
  const d = (payload?.data ?? {}) as { subscription?: { subscriber?: { code?: unknown } }; subscriber?: { code?: unknown } };
  return String(d.subscription?.subscriber?.code || d.subscriber?.code || "").trim();
}
