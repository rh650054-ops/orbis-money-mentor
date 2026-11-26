/* "Já paguei, conferir" (Rick, 26/11/2026). Pure rules (tested): given what Hotmart's API says
   about ONE of the person's subscriptions, what to do here. Never charges, cancels or creates
   anything at Hotmart: it only reads there and releases access here when Hotmart says it is paid.
     · status changed at Hotmart → record it (the renewal path is recalculated from it);
     · ACTIVE with the next charge in the future and access blocked here → release until that
       charge (same function the webhook uses, so a repeated check changes nothing);
     · anything else → nothing to release. */
import { diasDePro } from "../hotmart-webhook/planos.ts";

export interface NossaAssinatura { subscription_id: string; status_hotmart: string | null; oferta_codigo: string | null; plano: string | null }
export interface NaHotmart { status: string | null; date_next_charge: number | null }
export interface Decisao { gravarStatus: string | null; liberarAte: string | null; proAte: string | null }

export function decidir(nossa: NossaAssinatura, real: NaHotmart, acessoLiberado: boolean, agora = new Date()): Decisao {
  const status = (real.status ?? "").toUpperCase() || null;
  const gravarStatus = status && status !== (nossa.status_hotmart ?? "").toUpperCase() ? status : null;
  const fim = real.date_next_charge && real.date_next_charge > agora.getTime() ? new Date(real.date_next_charge) : null;
  if (status !== "ACTIVE" || !fim || acessoLiberado) return { gravarStatus, liberarAte: null, proAte: null };
  const ehPro = !!diasDePro(nossa.oferta_codigo ?? "", nossa.plano ?? "");
  const proAte = ehPro ? new Date(fim.getTime() + 3 * 86_400_000).toISOString() : null;
  return { gravarStatus, liberarAte: fim.toISOString(), proAte };
}
