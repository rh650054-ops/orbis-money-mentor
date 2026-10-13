/* ONE rule for "this subscription gives access" (13/10/2026). useSubscription (the
   gate) and the "Já paguei" checks used to disagree: the modal demanded grace_until
   while the hook accepted an active row without it, so a paid user could be told
   "liberado", reload, and land on the blocked screen again. Both use this now. */

export type LinhaAssinatura = { status: string | null; grace_until: string | null };
export type PerfilAcesso = {
  plan_status: string | null;
  is_demo: boolean | null;
  billing_exempt: boolean | null;
};

/** Active counts as paid even without grace_until (manual activation / event without
 *  grace); past_due only while inside the grace window. */
export function assinaturaAtiva(sub: LinhaAssinatura, agora: Date = new Date()): boolean {
  const grace = sub.grace_until ? new Date(sub.grace_until) : null;
  if (sub.status === "active") return !grace || agora <= grace;
  if (sub.status === "past_due") return !!grace && agora <= grace;
  return false;
}

/** Paid access, same order as useSubscription minus the trial: demo/admin first, then
 *  the subscriptions row (when there is one it decides), then a manual plan_status. */
export function temAcessoPago(
  perfil: PerfilAcesso | null,
  sub: LinhaAssinatura | null,
  agora: Date = new Date(),
): boolean {
  if (!perfil) return false;
  if (perfil.is_demo && perfil.billing_exempt) return true;
  if (sub) return assinaturaAtiva(sub, agora);
  return perfil.plan_status === "active";
}
