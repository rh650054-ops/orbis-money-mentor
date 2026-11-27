/* THE PURCHASE FLOW (pure: the store, the server and the session come in by injection).

   The rule that everything here serves (Rick, 27/11/2026): "Somente finalize uma transação no
   StoreKit depois de seu processamento seguro e persistente. Se a validação falhar, permita a
   recuperação sem exigir que o cliente compre novamente."

   StoreKit keeps every paid transaction as "unfinished" until the app finishes it, and hands it
   back on every launch. So the app finishes a transaction ONLY when the server answered that it is
   stored. Anything else (no internet, server down, session expired, app killed) leaves it
   unfinished, and `recuperar` sends it again later. The customer never pays twice and never has
   to buy again. */
import type { Ponte } from "./ponte";
import { codigoDoErro } from "./ponte";
import type { ResultadoCompra, TransacaoApple } from "../types";

export type RespostaDoServidor =
  | { tipo: "ok"; resultados: { resultado: string }[] }
  | { tipo: "sem_internet" } | { tipo: "servidor" } | { tipo: "sessao" };

export interface Deps {
  ponte: Ponte;
  /** apple-validar: sends the signed transactions, in order; the answer has one result per transaction */
  validar: (jws: string[]) => Promise<RespostaDoServidor>;
  /** the logged-in VANT account, or null */
  conta: () => string | null;
}

/** Stored by the server (or already known to it): safe to finish. */
const GUARDADA = new Set(["gravada", "antigo_ignorado", "periodo_antigo"]);
/** Nothing will ever come of it: finish so it stops coming back. */
const SEM_VOLTA = new Set(["reembolsada", "produto_desconhecido", "nao_e_assinatura"]);
const FALHAS_DA_LOJA = new Set(["sem_internet", "produto_indisponivel", "compra_nao_permitida"]);

export function criarFluxo(deps: Deps) {
  const emCurso = new Map<string, Promise<ResultadoCompra>>();

  async function processarUma(t: TransacaoApple): Promise<ResultadoCompra> {
    const conta = deps.conta();
    if (!conta) return { estado: "aguardando_servidor", produto: t.produto, motivo: "sessao" };
    // bought on this iPhone for ANOTHER VANT account (the person changed account in the middle):
    // not sent as this account's, and NOT finished, so its owner still gets it at the next login
    if (t.conta && t.conta.toLowerCase() !== conta.toLowerCase()) return { estado: "de_outra_conta", produto: t.produto };

    const r = await deps.validar([t.jws]).catch((): RespostaDoServidor => ({ tipo: "sem_internet" }));
    if (r.tipo !== "ok") return { estado: "aguardando_servidor", produto: t.produto, motivo: r.tipo };
    const resultado = r.resultados[0]?.resultado ?? "tente_de_novo";
    if (GUARDADA.has(resultado)) {
      await deps.ponte.concluir({ transacao: t.transacao });
      return { estado: "liberada", produto: t.produto };
    }
    if (SEM_VOLTA.has(resultado)) {
      await deps.ponte.concluir({ transacao: t.transacao });
      return { estado: "recusada", produto: t.produto, motivo: resultado };
    }
    if (resultado === "pertence_a_outra_conta") return { estado: "de_outra_conta", produto: t.produto };
    if (resultado === "tente_de_novo") return { estado: "aguardando_servidor", produto: t.produto, motivo: "servidor" };
    // 27/11/2026: Apple paid and StoreKit verified it HERE, but our server refused the signature. That
    // is our side failing (the first Sandbox purchase hit exactly this), never the customer's: keep it
    // unfinished, say the payment is safe, and send it again until the server confirms it.
    if (resultado === "assinatura_invalida" && t.verificadaNoAparelho !== false) return { estado: "aguardando_servidor", produto: t.produto, motivo: "servidor" };
    return { estado: "recusada", produto: t.produto, motivo: resultado };
  }

  /** One transaction to the server and, only if it was stored, finished. The same transaction
      arriving twice at once (the purchase result and the listener) is processed once. */
  function processar(t: TransacaoApple): Promise<ResultadoCompra> {
    const ja = emCurso.get(t.transacao);
    if (ja) return ja;
    const p = processarUma(t).finally(() => emCurso.delete(t.transacao));
    emCurso.set(t.transacao, p);
    return p;
  }

  /** Opens Apple's sheet for one product and follows the purchase to the end. */
  async function comprar(produto: string): Promise<ResultadoCompra> {
    const conta = deps.conta();
    if (!conta) return { estado: "falhou", motivo: "sem_sessao" };
    let r;
    try {
      r = await deps.ponte.comprar({ produto, conta });
    } catch (e) {
      const c = codigoDoErro(e);
      if (c === "cancelada") return { estado: "cancelada" };
      return { estado: "falhou", motivo: FALHAS_DA_LOJA.has(c) ? (c as "sem_internet") : "falha_na_loja" };
    }
    if (r.estado === "cancelada") return { estado: "cancelada" };
    if (r.estado === "pendente") return { estado: "pendente_aprovacao", produto };
    if (r.estado !== "comprada") return { estado: "falhou", motivo: "falha_na_loja" };
    return processar(r);
  }

  /** Every paid transaction StoreKit still holds: on launch, on login, when the app comes back,
      when the internet returns. Never opens a purchase. */
  async function recuperar(): Promise<ResultadoCompra[]> {
    if (!deps.conta()) return [];
    const { transacoes } = await deps.ponte.pendentes().catch(() => ({ transacoes: [] as TransacaoApple[] }));
    const saida: ResultadoCompra[] = [];
    for (const t of transacoes) saida.push(await processar(t));
    return saida;
  }

  /** "Restaurar compras": asks the App Store again, then sends what this Apple account has. */
  async function restaurar(): Promise<{ estado: "restaurada" | "nada" | "aguardando_servidor" | "de_outra_conta" | "falhou"; resultados: ResultadoCompra[] }> {
    if (!deps.conta()) return { estado: "falhou", resultados: [] };
    try { await deps.ponte.sincronizar(); } catch (e) { if (codigoDoErro(e) !== "cancelada") return { estado: "falhou", resultados: [] }; }
    const pendentes = await recuperar();
    const { transacoes } = await deps.ponte.direitos().catch(() => ({ transacoes: [] as TransacaoApple[] }));
    const resultados = [...pendentes];
    for (const t of transacoes) resultados.push(await processar(t));
    const tem = (e: ResultadoCompra["estado"]) => resultados.some((x) => x.estado === e);
    return { estado: tem("liberada") ? "restaurada" : tem("aguardando_servidor") ? "aguardando_servidor" : tem("de_outra_conta") ? "de_outra_conta" : "nada", resultados };
  }

  return { comprar, processar, recuperar, restaurar };
}
export type Fluxo = ReturnType<typeof criarFluxo>;
