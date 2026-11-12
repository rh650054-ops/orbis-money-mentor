/* "Da última vez: R$ X" no Tô no mercado (Rick, 12/11): tem que ser o preço que ele PAGOU
   na ÚLTIMA compra daquele item, na prateleira — o mesmo número que ele digita agora.

   Antes a tela usava compras_mercadoria.custo_unitario, que é o preço DEPOIS do desconto do
   caixa repartido entre os itens (aplicarDesconto). Ex.: 26/10 ele digitou o creme de leite a
   R$ 1,89, a compra teve 7,8% de desconto e ficou gravado R$ 1,74 — que não é nenhum preço que
   ele viu, e parecia "o menor do histórico". Agora: o preço digitado nessa última compra
   (mercado_compras.itens guarda os itens como foram digitados); compra antiga, sem esse
   registro, continua com o valor gravado. */

export interface CompraDoItem { ingredient_id: string | null; custo_unitario: number; mercado_compra_id: string | null }
export interface ItemDigitado { id: string | null; tipo: string; preco_unit: number | null }

/** Último preço por ingrediente, na unidade de medida. `compras` vem da mais nova pra mais velha. */
export function ultimosPrecos(compras: CompraDoItem[], digitados: Map<string, ItemDigitado[]>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of compras) {
    const id = c.ingredient_id;
    if (!id || id in out) continue; // só a compra mais recente de cada item
    const naCompra = c.mercado_compra_id ? digitados.get(c.mercado_compra_id) : undefined;
    const dig = naCompra?.find((i) => i.tipo === "ingrediente" && i.id === id && (i.preco_unit ?? 0) > 0);
    out[id] = dig?.preco_unit ?? c.custo_unitario;
  }
  return out;
}
