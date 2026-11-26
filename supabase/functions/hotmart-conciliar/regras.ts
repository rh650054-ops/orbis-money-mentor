/* "Já paguei, conferir" (Rick, 26/11/2026). Pure rules (tested): given what Hotmart's API says
   about ONE of the person's subscriptions, what to do here. Never charges, cancels or creates
   anything at Hotmart: it only reads there and releases access here when Hotmart says it is paid.
     · status changed at Hotmart → record it (the renewal path is recalculated from it);
     · ACTIVE with the next charge in the future and access blocked here → release until that
       charge (same function the webhook uses, so a repeated check changes nothing);
     · the subscriber Hotmart shows today must be the same buyer whose purchase linked this
       subscription to the account (titularidade); otherwise nothing is released;
     · anything else → nothing to release. */

/** Same buyer? Both e-mails known and equal (case/space-insensitive). Unknown on either side = not proven. */
export const mesmoTitular = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
import { diasDePro } from "../hotmart-webhook/planos.ts";

export interface NossaAssinatura { subscription_id: string; status_hotmart: string | null; oferta_codigo: string | null; plano: string | null;
  /** buyer e-mail Hotmart sent when this subscription was linked to the account (webhook) */
  email?: string | null }
export interface NaHotmart { status: string | null; date_next_charge: number | null;
  /** the subscriber's e-mail Hotmart returns today for this subscription code */
  email?: string | null }
export interface Decisao { gravarStatus: string | null; liberarAte: string | null; proAte: string | null }

export function decidir(nossa: NossaAssinatura, real: NaHotmart, acessoLiberado: boolean, agora = new Date()): Decisao {
  const status = (real.status ?? "").toUpperCase() || null;
  // 26/11: our webhook says PAST_DUE where the API says DELAYED (same "overdue"): not a stale record
  const classe = (x: string) => (["PAST_DUE", "DELAYED", "OVERDUE"].includes(x) ? "ATRASADA" : x);
  const gravarStatus = status && classe(status) !== classe((nossa.status_hotmart ?? "").toUpperCase()) ? status : null;
  const fim = real.date_next_charge && real.date_next_charge > agora.getTime() ? new Date(real.date_next_charge) : null;
  if (status !== "ACTIVE" || !fim || acessoLiberado || !mesmoTitular(nossa.email, real.email)) return { gravarStatus, liberarAte: null, proAte: null };
  const ehPro = !!diasDePro(nossa.oferta_codigo ?? "", nossa.plano ?? "");
  const proAte = ehPro ? new Date(fim.getTime() + 3 * 86_400_000).toISOString() : null;
  return { gravarStatus, liberarAte: fim.toISOString(), proAte };
}
