/* "Tô no mercado" — a mesma conta que o banco faz em mercado_concluir
   (supabase/migrations/20261013010000_mercado_compras.sql), para a prévia ao vivo
   mostrar exatamente o que vai acontecer ao concluir. Puro, sem React. */

export type TipoLinha = "ingrediente" | "produto" | "novo";

export interface LinhaMercado {
  key: string;
  tipo: TipoLinha;
  /** null em "novo" (item digitado) */
  id: string | null;
  nome: string;
  qtd: number;
  precoUnit: number | null;
  /** produtos que recebem este ingrediente (vazio = automático quando só 1 receita usa) */
  para: string[];
}

export interface IngredienteMercado {
  id: string; name: string; unit: string; stock_quantity: number; cost_per_unit: number;
  /** quanto vem em cada compra (pacote de 100 canudos); 1 = compra de 1 em 1 */
  pacote_qtd?: number;
}

/** A linha na tela conta PACOTES e preço do PACOTE; a conta e o banco trabalham na
 *  unidade de medida (2 pacotes de 100 = 200 canudos, R$ 8 o pacote = R$ 0,08 cada). */
export function emUnidades(l: LinhaMercado, base: BaseMercado): LinhaMercado {
  if (l.tipo !== "ingrediente") return l;
  const pac = base.ingredientes.find((i) => i.id === l.id)?.pacote_qtd ?? 1;
  if (!(pac > 1)) return l;
  return { ...l, qtd: l.qtd * pac, precoUnit: l.precoUnit != null ? l.precoUnit / pac : null };
}
export interface ReceitaMercado { product_id: string; ingredient_id: string; quantity: number }
export interface ProdutoMercado {
  id: string; name: string; emoji: string | null; cost: number; stock_quantity: number;
  recipe_mode: string | null; batch_yield: number; origem: "compra" | "faz" | null;
}

export interface BaseMercado { ingredientes: IngredienteMercado[]; receitas: ReceitaMercado[]; produtos: ProdutoMercado[] }

export interface ResultadoProduto { id: string; nome: string; receitas: number; unidades: number; faltam: string[] }
export interface PreviaMercado {
  produtos: ResultadoProduto[];
  prontos: { id: string; nome: string; unidades: number }[];
  /** linhas que ainda precisam de "pra qual produto?" */
  pendentes: string[];
}

const EPS = 1e-9;
export const ehLote = (p: ProdutoMercado) => p.recipe_mode === "batch" && p.batch_yield > 0;
/** "Compro pronto": o estoque é o próprio produto. */
export const compraPronto = (p: ProdutoMercado) => p.origem === "compra" || p.recipe_mode !== "batch";

/** Produtos em lote cuja receita usa este ingrediente. */
export function produtosDoIngrediente(ingId: string, base: BaseMercado): string[] {
  const ids = new Set(base.receitas.filter((r) => r.ingredient_id === ingId && r.quantity > 0).map((r) => r.product_id));
  return base.produtos.filter((p) => ids.has(p.id) && ehLote(p)).map((p) => p.id);
}

/** Para onde a linha vai de fato: o que o vendedor escolheu, ou a única receita que usa. */
export function paraEfetivo(l: LinhaMercado, base: BaseMercado): string[] {
  if (l.tipo !== "ingrediente" || !l.id) return [];
  if (l.para.length > 0) return l.para;
  const usam = produtosDoIngrediente(l.id, base);
  return usam.length === 1 ? usam : [];
}

export function precisaEscolher(l: LinhaMercado, base: BaseMercado): boolean {
  return l.tipo === "ingrediente" && !!l.id && l.para.length === 0 && produtosDoIngrediente(l.id, base).length > 1;
}

export function calcularMercado(linhas: LinhaMercado[], base: BaseMercado): PreviaMercado {
  const validas = linhas.filter((l) => l.qtd > 0);
  const pendentes = validas.filter((l) => precisaEscolher(l, base)).map((l) => l.key);

  // quanto de cada ingrediente vai pra cada produto, e a ordem dos produtos
  const aloc = new Map<string, number>();
  const cands: string[] = [];
  for (const l of validas) {
    const para = paraEfetivo(l, base);
    for (const pid of para) {
      if (!cands.includes(pid)) cands.push(pid);
      const k = `${l.id}:${pid}`;
      aloc.set(k, (aloc.get(k) ?? 0) + l.qtd / para.length);
    }
  }
  // estoque de ingrediente que já existia antes da compra
  const pool = new Map(base.ingredientes.map((i) => [i.id, Math.max(i.stock_quantity, 0)]));
  const nomeIng = new Map(base.ingredientes.map((i) => [i.id, i.name]));

  const produtos: ResultadoProduto[] = [];
  for (const pid of cands) {
    const p = base.produtos.find((x) => x.id === pid);
    if (!p || !ehLote(p)) continue;
    const rec = base.receitas.filter((r) => r.product_id === pid && r.quantity > 0);
    const disp = (iid: string) => (aloc.get(`${iid}:${pid}`) ?? 0) + (pool.get(iid) ?? 0);
    let receitas = rec.length ? Math.min(...rec.map((r) => Math.floor(disp(r.ingredient_id) / r.quantity + EPS))) : 0;
    receitas = Math.max(receitas, 0);
    const faltam = receitas > 0 ? [] : rec
      .filter((r) => Math.floor(disp(r.ingredient_id) / r.quantity + EPS) < 1)
      .map((r) => nomeIng.get(r.ingredient_id) ?? "ingrediente");
    for (const r of rec) {
      const need = receitas * r.quantity - Math.min(aloc.get(`${r.ingredient_id}:${pid}`) ?? 0, receitas * r.quantity);
      if (need > 0) pool.set(r.ingredient_id, Math.max((pool.get(r.ingredient_id) ?? 0) - need, 0));
    }
    produtos.push({ id: pid, nome: p.name, receitas, unidades: Math.round(receitas * p.batch_yield), faltam });
  }

  const prontosMap = new Map<string, number>();
  for (const l of validas) if (l.tipo === "produto" && l.id) prontosMap.set(l.id, (prontosMap.get(l.id) ?? 0) + l.qtd);
  const prontos = [...prontosMap].map(([id, q]) => ({
    id, nome: base.produtos.find((p) => p.id === id)?.name ?? "Produto", unidades: Math.round(q),
  }));
  return { produtos, prontos, pendentes };
}

const cent = (n: number) => Math.round(n * 100) / 100;

/** Custo atual de 1 unidade do item da linha (para não puxar o custo médio pra zero). */
export function custoAtual(l: LinhaMercado, base: BaseMercado): number {
  if (l.tipo === "produto") return base.produtos.find((p) => p.id === l.id)?.cost ?? 0;
  if (l.tipo === "ingrediente") return base.ingredientes.find((i) => i.id === l.id)?.cost_per_unit ?? 0;
  const nome = l.nome.trim().toLowerCase();
  return base.ingredientes.find((i) => i.name.trim().toLowerCase() === nome)?.cost_per_unit ?? 0;
}

/** Valor pago por linha (0 = sem valor: só soma estoque). Igual ao passo (1) do banco. */
export function totaisDasLinhas(linhas: LinhaMercado[], porItem: boolean, total: number | null, base: BaseMercado): number[] {
  if (porItem) return linhas.map((l) => ((l.precoUnit ?? 0) > 0 ? cent(l.qtd * (l.precoUnit ?? 0)) : 0));
  if (!total || total <= 0 || linhas.length === 0) return linhas.map(() => 0);
  let pesos = linhas.map((l) => l.qtd * custoAtual(l, base));
  if (pesos.reduce((s, x) => s + x, 0) <= 0) pesos = linhas.map((l) => l.qtd);
  const soma = pesos.reduce((s, x) => s + x, 0);
  let acum = 0;
  return pesos.map((w, i) => {
    if (i < pesos.length - 1) { const v = cent((total * w) / soma); acum += v; return v; }
    return Math.max(cent(cent(total) - acum), 0);
  });
}

/** O que vai para a RPC mercado_concluir. */
export function itensParaRpc(linhas: LinhaMercado[], porItem: boolean, base: BaseMercado) {
  return linhas.filter((l) => l.qtd > 0).map((l) => ({
    tipo: l.tipo, id: l.id, nome: l.nome, qtd: l.qtd,
    preco_unit: porItem && (l.precoUnit ?? 0) > 0 ? l.precoUnit : null,
    para: paraEfetivo(l, base),
  }));
}
