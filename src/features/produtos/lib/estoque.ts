/* Aba Estoque — "gerente de estoque" (25/11/2026, Rick). What I have, what is running out and what I
   need to buy for the next production. Pure, read-only: it never changes stock.
   Consumption follows the same rule as the database (producao_estado_alvo): for N units of an item,
   each recipe line takes N ÷ (the item's yield) × its quantity per batch; the base lines go into a
   flavour only when the flavour takes the base. The database is still the judge when producing. */
import { itensDeProducao, linhasDoItem, type CatalogoProducao, type ItemProducao } from "./producao";

/** Names that are a COST, not something on a shelf (labour, gas, fees). Only a hint: typed as an
 *  ingredient they block production with stock 0; they belong in "custos sem estoque". */
export const pareceCusto = (nome: string) =>
  /m[aã]o\s*de\s*obra|^\s*produ[cç][aã]o\s*$|trabalho|sal[aá]rio|di[aá]ria|^\s*g[aá]s\s*$|energia|\bluz\b|taxa|comiss[aã]o|frete/i.test(nome);

/** "Batida Morango"; "Cremo Morango" (not "Cremo Morango Morango") when the product already says it */
export const nomeDoItem = (i: Pick<ItemProducao, "produto" | "sabor">) =>
  !i.sabor || i.produto.name.toLowerCase().includes(i.sabor.name.trim().toLowerCase()) ? i.produto.name : `${i.produto.name} ${i.sabor.name}`;

export interface Pedido { produto: string; sabor: string | null; unidades: number }
export interface LinhaCompra {
  ingrediente: string; nome: string; unidade: string; precisa: number; tem: number; falta: number;
  /** a cost typed as an ingredient (labour…): it is not bought; listed apart */
  custo: boolean; usadoEm: string[];
  /** estimated cost of what is missing, only with a known price (last purchase / recipe) */
  custoCompra: number | null;
}
export interface ListaCompras {
  linhas: LinhaCompra[];
  /** items whose recipe is missing quantities or yield: the forecast is partial for them */
  parciais: { item: string; motivo: string }[];
}

const arred = (n: number) => Math.round(n * 1000) / 1000;

/** "Quero produzir 40 de maracujá (+ 20 de morango)": what goes out of each ingredient, consolidated
 *  (a shared ingredient counts its stock once), and what is missing. Lines with no quantity or an
 *  item with no yield are NOT guessed: they make the forecast partial. */
export function listaDeCompras(c: CatalogoProducao, pedidos: Pedido[]): ListaCompras {
  const itens = itensDeProducao(c).flatMap((g) => g.itens);
  const ing = new Map(c.ingredientes.map((i) => [i.id, i]));
  const soma = new Map<string, { precisa: number; usadoEm: Set<string> }>();
  const parciais: ListaCompras["parciais"] = [];
  for (const p of pedidos) {
    if (!(p.unidades > 0)) continue;
    const it = itens.find((x) => x.produto.id === p.produto && (x.sabor?.id ?? null) === p.sabor);
    if (!it) continue;
    const nome = nomeDoItem(it);
    if (!(it.rende > 0)) { parciais.push({ item: nome, motivo: "a receita não diz quantas unidades rende" }); continue; }
    if (it.pendentes.length > 0) parciais.push({ item: nome, motivo: `falta quanto usa de ${it.pendentes.join(", ")}` });
    for (const r of linhasDoItem(c, it.produto, it.sabor)) {
      if (!(r.quantity > 0) || r.aprender) continue;
      const atual = soma.get(r.ingredient_id) ?? { precisa: 0, usadoEm: new Set<string>() };
      atual.precisa += (p.unidades / it.rende) * r.quantity;
      atual.usadoEm.add(nome);
      soma.set(r.ingredient_id, atual);
    }
  }
  const linhas = [...soma.entries()].map(([id, v]) => {
    const g = ing.get(id);
    const tem = Math.max(0, g?.stock_quantity ?? 0);
    const precisa = arred(v.precisa);
    const custo = pareceCusto(g?.name ?? "");
    // things bought by the unit (bottles, boxes) are bought whole: 0,33 box missing = buy 1
    const bruto = Math.max(0, precisa - tem);
    const falta = custo ? 0 : (g?.unit ?? "un") === "un" ? Math.max(0, Math.ceil(bruto - 1e-9)) : arred(bruto);
    const preco = g?.cost_per_unit ?? 0;
    return { ingrediente: id, nome: g?.name ?? "ingrediente", unidade: g?.unit ?? "un", precisa, tem, falta, custo, usadoEm: [...v.usadoEm],
      custoCompra: falta > 0 && preco > 0 ? Math.round(falta * preco * 100) / 100 : null };
  }).sort((a, b) => Number(b.falta > 0) - Number(a.falta > 0) || a.nome.localeCompare(b.nome, "pt-BR"));
  return { linhas, parciais };
}

/** What needs attention, by ingredient, for the NEXT recipe (one batch) of each item: */
export type TipoAlerta = "esgotado" | "insuficiente" | "custo" | "incompleta";
export interface Alerta {
  tipo: TipoAlerta; titulo: string;
  ingrediente?: string; unidade?: string; tem?: number; precisa?: number; falta?: number;
  afetados: string[];
}

export function alertasDoEstoque(c: CatalogoProducao): Alerta[] {
  const itens = itensDeProducao(c).flatMap((g) => g.itens);
  const ing = new Map(c.ingredientes.map((i) => [i.id, i]));
  const porIng = new Map<string, { precisa: number; afetados: string[] }>();
  const alertas: Alerta[] = [];
  for (const it of itens) {
    const nome = nomeDoItem(it);
    if (it.situacao === "incompleta" || it.situacao === "sem_rendimento") {
      alertas.push({ tipo: "incompleta", titulo: it.situacao === "sem_rendimento" ? "Falta dizer quanto a receita rende" : `Falta quanto usa de ${it.pendentes.join(", ") || "um ingrediente"}`, afetados: [nome] });
      continue;
    }
    if (it.situacao !== "pronta") continue;
    for (const r of linhasDoItem(c, it.produto, it.sabor)) {
      if (!(r.quantity > 0)) continue;
      const a = porIng.get(r.ingredient_id) ?? { precisa: 0, afetados: [] };
      a.precisa = Math.max(a.precisa, r.quantity);   // the most one batch of any of them takes
      a.afetados.push(nome);
      porIng.set(r.ingredient_id, a);
    }
  }
  for (const [id, a] of porIng) {
    const g = ing.get(id);
    if (!g) continue;
    const tem = Math.max(0, g.stock_quantity);
    if (pareceCusto(g.name)) {
      if (tem < a.precisa) alertas.push({ tipo: "custo", titulo: `${g.name} parece custo, não ingrediente`, ingrediente: g.name, unidade: g.unit, tem, precisa: arred(a.precisa), falta: arred(a.precisa - tem), afetados: [...new Set(a.afetados)] });
      continue;
    }
    if (tem >= a.precisa) continue;
    alertas.push({ tipo: tem <= 0 ? "esgotado" : "insuficiente", titulo: g.name, ingrediente: g.name, unidade: g.unit, tem, precisa: arred(a.precisa), falta: arred(a.precisa - tem), afetados: [...new Set(a.afetados)] });
  }
  const ordem: Record<TipoAlerta, number> = { esgotado: 0, insuficiente: 1, custo: 2, incompleta: 3 };
  return alertas.sort((x, y) => ordem[x.tipo] - ordem[y.tipo]);
}

/** Items (product or flavour) with something blocking the next recipe: counted once each. */
export const receitasComAtencao = (alertas: Alerta[]) => new Set(alertas.flatMap((a) => a.afetados)).size;

/** Each ingredient's state against the recipes that use it (one batch). */
export type SituacaoIngrediente = "disponivel" | "baixo" | "esgotado";
export function situacaoDosIngredientes(c: CatalogoProducao): Map<string, SituacaoIngrediente> {
  const maior = new Map<string, number>();
  for (const it of itensDeProducao(c).flatMap((g) => g.itens)) {
    for (const r of linhasDoItem(c, it.produto, it.sabor)) if (r.quantity > 0) maior.set(r.ingredient_id, Math.max(maior.get(r.ingredient_id) ?? 0, r.quantity));
  }
  return new Map(c.ingredientes.map((i) => {
    const tem = i.stock_quantity;
    const uma = maior.get(i.id) ?? 0;
    return [i.id, tem <= 0 ? "esgotado" : uma > 0 && tem < uma ? "baixo" : "disponivel"];
  }));
}

const f = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: x < 10 ? 2 : 1 });
/** Stock in its OWN unit (1000 g → "1 kg", 1500 ml → "1,5 L", 100 un → "100 un"), plus how many
 *  purchases that is when the purchase size is known ("1 pacote de 100"). Never un ↔ L or g ↔ ml. */
export function qtdNaTela(estoque: number, unidade: string, pacote = 1): { principal: string; sub?: string } {
  const e = Math.max(0, estoque);
  const u = (unidade || "un").toLowerCase();
  const principal = u === "g" && e >= 1000 ? `${f(e / 1000)} kg` : u === "ml" && e >= 1000 ? `${f(e / 1000)} L` : `${f(e)} ${u}`;
  if (!(pacote > 1) || e <= 0) return { principal };
  const tam = u === "g" && pacote >= 1000 ? `${f(pacote / 1000)} kg` : u === "ml" && pacote >= 1000 ? `${f(pacote / 1000)} L` : `${f(pacote)} ${u}`;
  const qtd = e / pacote;
  return { principal, sub: `${f(qtd)} ${u === "un" ? (qtd === 1 ? "pacote" : "pacotes") : (qtd === 1 ? "embalagem" : "embalagens")} de ${tam}` };
}

/** The list as text to copy or share (WhatsApp, notes). */
export function textoDaLista(pedidos: { nome: string; unidades: number }[], l: ListaCompras, feitos: Set<string>): string {
  const reais = (x: number) => x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const linhas = l.linhas.filter((x) => !x.custo && x.falta > 0).map((x) =>
    `${feitos.has(x.ingrediente) ? "✅" : "⬜"} ${x.nome}: comprar ${qtdNaTela(x.falta, x.unidade).principal} (precisa ${f(x.precisa)}, tem ${f(x.tem)} ${x.unidade})${x.custoCompra ? ` ≈ ${reais(x.custoCompra)}` : ""}`);
  const total = l.linhas.reduce((t, x) => t + (x.custoCompra ?? 0), 0);
  return [`Lista de compras VANT — para ${pedidos.map((p) => `${p.unidades} ${p.nome}`).join(", ")}`, ...linhas,
    ...(total > 0 ? [`Estimativa: ${reais(total)} (pelos últimos preços)`] : []),
    ...l.parciais.map((p) => `⚠️ ${p.item}: previsão parcial (${p.motivo})`)].join("\n");
}
