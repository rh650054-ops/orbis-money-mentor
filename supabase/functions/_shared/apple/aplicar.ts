/* Apple subscriptions: the one place that writes a verified status to the database, shared by
   apple-validar, apple-webhook and apple-conciliar.
     public.apple_assinatura_gravar    the mirror and the access (who owns it, order, refunds)
     public.apple_transacao_registrar  the ledger (the money side), whatever the mirror answered
   Both are idempotent and take their own locks, so a repeated or concurrent call is safe. */
import { estado, linhaFinanceira, type Renovacao, type Transacao } from "./regras.ts";

export interface Banco {
  rpc(nome: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
export class ErroDeBanco extends Error {
  constructor(public funcao: string, mensagem: string) { super(`${funcao}: ${mensagem}`); this.name = "ErroDeBanco"; }
}

export async function chamar<T = unknown>(db: Banco, funcao: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(funcao, args);
  if (error) throw new ErroDeBanco(funcao, error.message);
  return data as T;
}

export interface Aplicado { resultado: string; financeiro: string | null }

/** user = the account the caller proved (session, or the token Apple signed); null = whoever
    already owns the subscription in the mirror. conferida = the status came from Apple's API. */
export async function aplicarEstado(
  db: Banco, user: string | null, t: Transacao, r: Renovacao | null, assinadoMs: number | undefined, conferida: boolean,
): Promise<Aplicado> {
  const e = estado(t, r, assinadoMs);
  if ("erro" in e) return { resultado: e.erro, financeiro: null };
  const resultado = await chamar<string>(db, "apple_assinatura_gravar", { p_user: user, ...e, p_conferida: conferida });
  // the sale exists whoever claims it; a restore attempt by ANOTHER account writes nothing at all
  let financeiro: string | null = null;
  if (resultado !== "pertence_a_outra_conta") {
    const linha = linhaFinanceira(t, user, assinadoMs);
    if (linha) financeiro = await chamar<string>(db, "apple_transacao_registrar", { ...linha });
  }
  return { resultado, financeiro };
}
