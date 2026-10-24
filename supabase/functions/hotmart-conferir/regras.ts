/* Which Hotmart subscriptions to cancel automatically (Rick, 24/10/2026).
   Pure rules (tested): the edge function feeds the subscriptions that are REALLY active
   at Hotmart (confirmed through the API) and gets back what to cancel and why.
     1) Has an active Pro → every standard plan of that person is cancelled (paid twice).
     2) No Pro but 2+ active standard plans with the same plan → keeps the one that is
        IN GOOD STANDING at Hotmart (ACTIVE beats DELAYED/OVERDUE), then the oldest
        (most charges; then oldest approval), and cancels the rest (duplicate checkout).
        24/10: without the first criterion it kept Docinho's late one and dropped the paying one.
   Never cancels a Pro, the bank add-on, or anything when there is more than one Pro
   (that one is for a human to look at). */
import { diasDePro } from "../hotmart-webhook/planos.ts";
import { BANCO_EXTRA } from "../hotmart-webhook/cancelar-padrao.ts";

export interface AssinaturaUsuario {
  subscription_id: string; user_id: string; oferta_codigo: string | null; plano: string | null;
  recorrencia_n: number | null; aprovado_em: string | null;
  /** status real na Hotmart (API): ACTIVE, DELAYED, OVERDUE */
  status_real?: string | null;
}
export interface Cancelar { subscription_id: string; user_id: string; motivo: "upgrade_pro" | "duplicada"; manter: string }

const ehBanco = (a: AssinaturaUsuario) => BANCO_EXTRA.has((a.oferta_codigo ?? "").trim());
const ehPro = (a: AssinaturaUsuario) => !!diasDePro((a.oferta_codigo ?? "").trim(), a.plano ?? "");
const chavePlano = (a: AssinaturaUsuario) => (a.plano ?? a.oferta_codigo ?? "").trim().toLowerCase();
const emDia = (a: AssinaturaUsuario) => (a.status_real ?? "ACTIVE") === "ACTIVE" ? 1 : 0;
const maisAntiga = (x: AssinaturaUsuario, y: AssinaturaUsuario) =>
  emDia(y) - emDia(x)
  || (y.recorrencia_n ?? 0) - (x.recorrencia_n ?? 0)
  || String(x.aprovado_em ?? "9999").localeCompare(String(y.aprovado_em ?? "9999"))
  || x.subscription_id.localeCompare(y.subscription_id);

export function oQueCancelar(ativas: AssinaturaUsuario[]): Cancelar[] {
  const porUsuario = new Map<string, AssinaturaUsuario[]>();
  for (const a of ativas) {
    if (!a.user_id || !a.subscription_id || ehBanco(a)) continue;
    porUsuario.set(a.user_id, [...(porUsuario.get(a.user_id) ?? []), a]);
  }
  const fora: Cancelar[] = [];
  for (const [user_id, lista] of porUsuario) {
    const pros = lista.filter(ehPro);
    const padroes = lista.filter((a) => !ehPro(a));
    if (pros.length > 1) continue;                    // dois Pro: decide uma pessoa
    if (pros.length === 1) {
      for (const p of padroes) fora.push({ subscription_id: p.subscription_id, user_id, motivo: "upgrade_pro", manter: pros[0]!.subscription_id });
      continue;
    }
    const grupos = new Map<string, AssinaturaUsuario[]>();
    for (const p of padroes) grupos.set(chavePlano(p), [...(grupos.get(chavePlano(p)) ?? []), p]);
    for (const g of grupos.values()) {
      if (g.length < 2) continue;
      const [fica, ...resto] = [...g].sort(maisAntiga);
      for (const r of resto) fora.push({ subscription_id: r.subscription_id, user_id, motivo: "duplicada", manter: fica!.subscription_id });
    }
  }
  return fora;
}
