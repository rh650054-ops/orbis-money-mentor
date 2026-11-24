/* Production screen (23/11/2026): what each product / flavour can produce, with the SAME rules the
   database applies in producao_estado_alvo (supabase/migrations/20261123120000_rendimento_por_sabor.sql).
   The database is still the judge: this only lets the screen explain things before sending. Pure. */

export interface ProdutoProducao {
  id: string; name: string; emoji: string | null; recipe_mode: string | null; batch_yield: number;
  origem: "compra" | "faz" | null; stock_quantity: number;
}
export interface SaborProducao {
  id: string; product_id: string; name: string; emoji: string; stock_quantity: number;
  /** null = the product's yield */
  batch_yield: number | null;
  usa_base: boolean;
}
export interface LinhaReceitaProducao {
  product_id: string; variant_id: string | null; ingredient_id: string; quantity: number; aprender: boolean;
}
export interface IngredienteProducao { id: string; name: string; unit: string; stock_quantity: number }
export interface CatalogoProducao {
  produtos: ProdutoProducao[]; sabores: SaborProducao[]; receitas: LinhaReceitaProducao[]; ingredientes: IngredienteProducao[];
}

export type SituacaoItem = "pronta" | "incompleta" | "sem_receita" | "sem_rendimento";
export interface ItemProducao {
  produto: ProdutoProducao; sabor: SaborProducao | null; situacao: SituacaoItem;
  /** units per batch used for this item */
  rende: number;
  /** 24/11: ingredients of this item still without a quantity ("ainda não sei"), by name */
  pendentes: string[];
}

const porUnidade = (p: ProdutoProducao) => p.recipe_mode === "per_unit";

/** Recipe rows that apply to an item (the base when it takes the base, plus the flavour's own). */
export function linhasDoItem(c: CatalogoProducao, p: ProdutoProducao, s: SaborProducao | null): LinhaReceitaProducao[] {
  return c.receitas.filter((r) => r.product_id === p.id && (
    (r.variant_id === null && (s === null || s.usa_base)) ||
    (!porUnidade(p) && s !== null && r.variant_id === s.id)));
}

export function situacaoDoItem(c: CatalogoProducao, p: ProdutoProducao, s: SaborProducao | null): SituacaoItem {
  const linhas = linhasDoItem(c, p, s);
  const validas = linhas.filter((r) => r.quantity > 0);
  if (validas.length === 0) return c.receitas.some((r) => r.product_id === p.id) ? "incompleta" : "sem_receita";
  if (!porUnidade(p) && linhas.some((r) => r.quantity <= 0 || r.aprender)) return "incompleta";
  if (!porUnidade(p) && (s?.batch_yield ?? p.batch_yield) <= 0) return "sem_rendimento";
  return "pronta";
}

/** Names of the ingredients an item still lacks a quantity for (the reason a recipe is incomplete). */
export function pendentesDoItem(c: CatalogoProducao, p: ProdutoProducao, s: SaborProducao | null): string[] {
  const nomes = new Map(c.ingredientes.map((i) => [i.id, i.name]));
  return [...new Set(linhasDoItem(c, p, s).filter((r) => r.quantity <= 0 || r.aprender).map((r) => nomes.get(r.ingredient_id) ?? "ingrediente"))];
}

/** Products the seller makes, each with one line per flavour (or one line when it has none). */
export function itensDeProducao(c: CatalogoProducao): { produto: ProdutoProducao; itens: ItemProducao[] }[] {
  return c.produtos
    .filter((p) => p.origem === "faz" || p.recipe_mode === "batch" || c.receitas.some((r) => r.product_id === p.id))
    .filter((p) => p.origem !== "compra")
    .map((p) => {
      const sabores = c.sabores.filter((s) => s.product_id === p.id);
      const lista = sabores.length > 0 ? sabores : [null];
      return {
        produto: p,
        itens: lista.map((s) => ({ produto: p, sabor: s, situacao: situacaoDoItem(c, p, s), rende: s?.batch_yield ?? p.batch_yield, pendentes: pendentesDoItem(c, p, s) })),
      };
    });
}

export const chaveItem = (produto: string, sabor: string | null) => `${produto}:${sabor ?? "-"}`;

/** What goes to producao_registrar / producao_simular (only lines with units). */
export function itensParaEnviar(qtd: Record<string, number>): { produto: string; sabor?: string; unidades: number }[] {
  return Object.entries(qtd)
    .filter(([, n]) => Number.isInteger(n) && n > 0)
    .map(([k, n]) => {
      const [produto = "", sabor = "-"] = k.split(":");
      return sabor === "-" ? { produto, unidades: n } : { produto, sabor, unidades: n };
    })
    .sort((a, b) => (a.produto + (a.sabor ?? "")).localeCompare(b.produto + (b.sabor ?? "")));
}

/** Messages for the refusals of the database (hint codes), in the seller's words. */
export function mensagemDaProducao(e: unknown): { codigo: string; texto: string } {
  const x = (e ?? {}) as { hint?: string; message?: string; code?: string };
  const codigo = x.hint ?? "";
  const msg = x.message ?? "";
  const fixos: Record<string, string> = {
    VANT_FALTA_INGREDIENTE: msg || "Falta ingrediente no estoque para essa produção.",
    VANT_UNIDADES_VENDIDAS: "Algumas dessas unidades já foram vendidas, então não dá para tirar do estoque.",
    VANT_RECEITA_INCOMPLETA: msg || "A receita está incompleta. Complete a ficha para produzir.",
    VANT_PRODUTO_SEM_RECEITA: msg || "Esse produto não tem receita.",
    VANT_RECEITA_SEM_RENDIMENTO: msg || "A receita não diz quantas unidades rende.",
    VANT_RECEITA_POR_SABOR: "Esse produto tem receita por sabor: registre por aqui.",
    VANT_CHAVE_CONFLITO: "Esse envio já foi usado para outra produção. Confira a lista e tente de novo.",
    VANT_REGISTRO_DESFEITO: "Essa produção já foi desfeita.",
    VANT_SEM_MUDANCA: "A correção é igual ao que já está registrado.",
    VANT_ITEM_APAGADO: "Um produto ou ingrediente dessa produção foi apagado do cadastro.",
  };
  if (fixos[codigo]) return { codigo, texto: fixos[codigo] };
  if (codigo.startsWith("VANT_")) return { codigo, texto: msg };
  const semRede = /failed to fetch|network|load failed|timeout/i.test(msg) || x.code === "FETCH_ERROR";
  return { codigo: semRede ? "SEM_REDE" : "ERRO", texto: semRede ? "Sem conexão. Nada se perde: tente de novo que a VANT não registra duas vezes." : "Não consegui registrar agora. Tente de novo." };
}

/** Refusals that are answered by asking the seller WHY (then the same production is sent again). */
export const pedeMotivo = (codigo: string) => codigo === "VANT_RECEITA_REDUZIDA" || codigo === "VANT_JUSTIFICATIVA_OBRIGATORIA";

/** One key per submission (8-100 chars [A-Za-z0-9:._-]), reused on every retry of the same content. */
export function novaChave(prefixo = "prod"): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefixo}:${r}`;
}

/** Which "Produzi" a product opens. The new screen when every line can produce (or the product has
 *  per-flavour data, which only the new flow computes). Otherwise the current one stays: a product
 *  without recipe or with an incomplete recipe keeps a working way to record its stock. */
export function usaProducaoNova(c: CatalogoProducao, produtoId: string): boolean {
  const p = c.produtos.find((x) => x.id === produtoId);
  if (!p) return false;
  const sabores = c.sabores.filter((s) => s.product_id === p.id);
  if (sabores.some((s) => s.batch_yield !== null || !s.usa_base)) return true;
  const linhas = sabores.length > 0 ? sabores : [null];
  return linhas.every((s) => situacaoDoItem(c, p, s) === "pronta");
}
