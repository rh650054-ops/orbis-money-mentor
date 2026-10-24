/* Upgrade pro Pro (mensal ou anual) cancela o débito automático da assinatura padrão
   (R$ 29,90 "Membro Fundador" e afins) — Rick, 19/10/2026. Sem isso o cliente paga as
   duas. Nunca derruba o webhook: o pagamento do Pro já está aprovado; se a Hotmart
   recusar ou as credenciais faltarem, fica no log como "cancelar na mão".

   Credenciais (só pelo painel do Supabase, nunca no código): HOTMART_CLIENT_ID,
   HOTMART_CLIENT_SECRET e HOTMART_BASIC (o "Basic" das Credenciais da Hotmart). */
import { diasDePro } from "./planos.ts";

export const BANCO_EXTRA = new Set(["3nnrr1xn", "otgozkn9"]);
const TOKEN_URL = "https://api-sec-vlc.hotmart.com/security/oauth/token";
const CANCEL_URL = "https://developers.hotmart.com/payments/api/v1/subscriptions/cancel";

export interface AssinaturaAtiva { subscription_id: string; oferta_codigo: string | null; plano?: string | null }

/** Assinaturas ativas que são o plano padrão (nem Pro, nem banco extra), fora a do Pro que acabou de entrar. */
export function padroesParaCancelar(ativas: AssinaturaAtiva[], codigoDoPro: string): string[] {
  return ativas
    .filter((a) => a.subscription_id && a.subscription_id !== codigoDoPro)
    // Pro = oferta conhecida OU nome do plano com "Pro" (mesma regra do diasDePro): uma oferta
    // Pro nova nunca é tratada como plano padrão e cancelada (24/10: ckkw1xkf não estava na lista).
    .filter((a) => { const o = (a.oferta_codigo ?? "").trim(); return !diasDePro(o, a.plano ?? "") && !BANCO_EXTRA.has(o); })
    .map((a) => a.subscription_id);
}

type Env = (k: string) => string | undefined;
type Busca = typeof fetch;

/** Pede o token e cancela. Devolve o que cancelou e o que ficou pra fazer na mão. */
export async function cancelarNaHotmart(codigos: string[], env: Env, busca: Busca = fetch): Promise<{ cancelados: string[]; naMao: string[]; motivo?: string }> {
  if (codigos.length === 0) return { cancelados: [], naMao: [] };
  const id = env("HOTMART_CLIENT_ID"), segredo = env("HOTMART_CLIENT_SECRET"), basic = env("HOTMART_BASIC");
  if (!id || !segredo || !basic) return { cancelados: [], naMao: codigos, motivo: "sem credenciais da API Hotmart" };
  try {
    const qs = new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: segredo });
    const t = await busca(`${TOKEN_URL}?${qs}`, { method: "POST", headers: { Authorization: basic.startsWith("Basic ") ? basic : `Basic ${basic}` } });
    if (!t.ok) return { cancelados: [], naMao: codigos, motivo: `token ${t.status}` };
    const { access_token } = await t.json() as { access_token?: string };
    if (!access_token) return { cancelados: [], naMao: codigos, motivo: "token vazio" };
    const r = await busca(CANCEL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ subscriber_code: codigos, send_mail: true }),
    });
    if (!r.ok) return { cancelados: [], naMao: codigos, motivo: `cancelar ${r.status}` };
    return { cancelados: codigos, naMao: [] };
  } catch (e) {
    return { cancelados: [], naMao: codigos, motivo: e instanceof Error ? e.message : "erro" };
  }
}
