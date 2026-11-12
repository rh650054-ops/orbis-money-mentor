// Vant — o que um pedido de token pode fazer (puro: testado no vitest).
//
// Dois pedidos diferentes chegam aqui:
//   * banco NOVO: gasta uma vaga do plano, entao confere o limite;
//   * AUTORIZAR DE NOVO um banco que ja e do vendedor: reaproveita o mesmo Item e nunca gasta vaga.
// Antes de 11/11/2026, pedir pra autorizar um Item que nao era (mais) do vendedor virava, calado,
// um pedido de banco novo: o app abria a tela errada e podia ate pedir compra de vaga.

export type Limite = { pode_conectar?: boolean; usados?: number; limite?: number } | null | undefined;

export type Pedido =
  | { erro: "item_nao_encontrado" }
  | { erro: "precisa_banco_extra"; usados?: number; limite?: number }
  | { corpo: { itemId?: string; options: { clientUserId: string; avoidDuplicates?: boolean } } };

/** Le o itemId do corpo do pedido: so texto nao vazio vale. */
export function itemPedido(corpo: unknown): string | null {
  const id = (corpo as { itemId?: unknown } | null)?.itemId;
  return typeof id === "string" && id.trim() !== "" ? id.trim() : null;
}

/** `ehDele`: existe conexao NAO removida desse Item para este vendedor. */
export function decidirPedido(p: { uid: string; item: string | null; ehDele: boolean; limite: Limite }): Pedido {
  if (p.item) {
    if (!p.ehDele) return { erro: "item_nao_encontrado" };
    return { corpo: { itemId: p.item, options: { clientUserId: p.uid } } };
  }
  if (p.limite && p.limite.pode_conectar === false) {
    return { erro: "precisa_banco_extra", usados: p.limite.usados, limite: p.limite.limite };
  }
  // 03/11: avoidDuplicates — tapping "Conectar" several times created the same bank 4–5 times
  return { corpo: { options: { clientUserId: p.uid, avoidDuplicates: true } } };
}
