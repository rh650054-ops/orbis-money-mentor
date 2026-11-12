// Vant — o que um pedido de token pode fazer (puro: testado no vitest).
//
// Dois pedidos diferentes chegam aqui:
//   * banco NOVO: gasta uma vaga do plano, entao confere o limite;
//   * AUTORIZAR DE NOVO um banco que ja e do vendedor: reaproveita o mesmo Item e nunca gasta vaga.
// Antes de 11/11/2026, pedir pra autorizar um Item que nao era (mais) do vendedor virava, calado,
// um pedido de banco novo: o app abria a tela errada e podia ate pedir compra de vaga.
//
// A6 (12/11/2026): the three questions asked before the bank's screen opens — is the seller Pro,
// is this bank the seller's (when reauthorising), is there a free slot (when it is a new bank) —
// can each FAIL to be answered. A failed question is not an answer: it used to open the widget
// without the slot being checked, tell a subscriber to "assine o Pro", or tell a seller the bank
// "não está mais ligado aqui". Now each question is asked once more and, if it still cannot be
// answered, the request ends as "consulta_indisponivel": nothing opens and nothing is concluded.

/** The plan's limit as open_finance_limite answers it. */
export type LimiteLido = { pode: boolean; usados?: number; limite?: number };

export type Pedido =
  | { erro: "precisa_pro" }
  | { erro: "consulta_indisponivel" }
  | { erro: "item_nao_encontrado" }
  | { erro: "precisa_banco_extra"; usados?: number; limite?: number }
  | { corpo: { itemId?: string; options: { clientUserId: string; avoidDuplicates?: boolean } } };

/** Le o itemId do corpo do pedido: so texto nao vazio vale. */
export function itemPedido(corpo: unknown): string | null {
  const id = (corpo as { itemId?: unknown } | null)?.itemId;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : null;
}

/** Pure: reads open_finance_limite's answer. undefined = cannot tell — never "may connect". */
export function lerLimite(resposta: unknown): LimiteLido | undefined {
  if (!resposta || typeof resposta !== "object" || Array.isArray(resposta)) return undefined;
  const r = resposta as { pode_conectar?: unknown; usados?: unknown; limite?: unknown };
  if (typeof r.pode_conectar !== "boolean") return undefined;
  return {
    pode: r.pode_conectar,
    ...(typeof r.usados === "number" ? { usados: r.usados } : {}),
    ...(typeof r.limite === "number" ? { limite: r.limite } : {}),
  };
}

/** Pure: the decision. `undefined` in pro / ehDele / limite = that question could not be answered.
 *  `ehDele`: existe conexao NAO removida desse Item para este vendedor. */
export function decidirPedido(p: {
  uid: string; item: string | null; pro: boolean | undefined; ehDele: boolean | undefined; limite: LimiteLido | undefined;
}): Pedido {
  if (p.pro === undefined) return { erro: "consulta_indisponivel" };
  if (!p.pro) return { erro: "precisa_pro" };
  if (p.item) {
    if (p.ehDele === undefined) return { erro: "consulta_indisponivel" };
    if (!p.ehDele) return { erro: "item_nao_encontrado" };
    return { corpo: { itemId: p.item, options: { clientUserId: p.uid } } };
  }
  if (!p.limite) return { erro: "consulta_indisponivel" }; // a slot that was not checked is not a free slot
  if (!p.limite.pode) return { erro: "precisa_banco_extra", usados: p.limite.usados, limite: p.limite.limite };
  // 03/11: avoidDuplicates — tapping "Conectar" several times created the same bank 4–5 times
  return { corpo: { options: { clientUserId: p.uid, avoidDuplicates: true } } };
}

/** The three questions. Each answers `undefined` when it could not be read (it may also throw). */
export interface Consultas {
  ehPro(): Promise<boolean | undefined>;
  ehDele(itemId: string): Promise<boolean | undefined>;
  /** The raw answer of open_finance_limite. */
  limite(): Promise<unknown>;
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** Asks; when there is no answer, once more after a short wait. undefined = no answer twice. */
async function duasVezes<T>(perguntar: () => Promise<T | undefined>, esperaMs: number): Promise<T | undefined> {
  const a = await perguntar().catch(() => undefined);
  if (a !== undefined) return a;
  if (esperaMs > 0) await esperar(esperaMs);
  return await perguntar().catch(() => undefined);
}

/** Asks only what this request needs, in order, and decides. Nothing here talks to Pluggy. */
export async function prepararPedido(c: Consultas, uid: string, corpo: unknown, esperaMs = 300): Promise<Pedido> {
  const semResposta = { ehDele: undefined, limite: undefined };
  const pro = await duasVezes(() => c.ehPro(), esperaMs);
  if (pro !== true) return decidirPedido({ uid, item: null, pro, ...semResposta });
  const item = itemPedido(corpo);
  if (item) {
    const ehDele = await duasVezes(() => c.ehDele(item), esperaMs);
    return decidirPedido({ uid, item, pro, ehDele, limite: undefined });
  }
  const limite = await duasVezes(async () => lerLimite(await c.limite()), esperaMs);
  return decidirPedido({ uid, item: null, pro, ehDele: undefined, limite });
}
