/* Raio-X math, pure (tested): state colors, "o que mais pesou", filters, recipients. */
import { COR } from "@/components/financas/planejar/ui";
import { referencia, type CatAnalise } from "@/components/financas/analise/tipos";
import type { CategoriaRX, Filtros, LancamentoRX } from "../types";

export const LARANJA = "#FF9F43";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesCurto = (iso: string) => MESES[Number(iso.slice(5, 7)) - 1] ?? "";
export const mesAnterior = (iso: string) => {
  const d = new Date(`${iso.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
};

/** Not spending: money that only moved, card bill paid (its purchases are already counted), unknown. */
export const FORA_DO_PESO = new Set(["transferencia_propria", "fatura_cartao", "nao_identificado", "estorno"]);

export function variacao(total: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((total - anterior) / anterior) * 100);
}

export interface Estado { cor: string; texto: string; pct: number }

/** Bar color = state, never identity. Uses the Análise reference (teto/ritmo/média) when there is one,
 *  otherwise compares with last month. */
export function estadoCategoria(c: CategoriaRX, ref: CatAnalise | undefined, corrente: boolean, mesAnt: string): Estado {
  if (ref) {
    const r = referencia(ref, corrente);
    if (r.metrica) {
      const x = r.pct / 100;
      const texto = x >= 2 ? `${Math.floor(x)}x acima do normal` : x > 1.05 ? `+${Math.round((x - 1) * 100)}% acima do normal` : x < 0.9 ? "abaixo do normal" : "no normal";
      return { cor: r.cor, texto, pct: Math.min(100, r.pct) };
    }
  }
  const v = variacao(c.total, c.anterior);
  if (v === null) return { cor: COR.mute, texto: "novo este mês", pct: 100 };
  const cor = v <= -10 ? COR.verde : v <= 10 ? COR.mute : v <= 30 ? COR.ouro : v <= 100 ? LARANJA : COR.coral;
  const texto = v >= 100 ? `${Math.round(c.total / c.anterior)}x ${mesCurto(mesAnt)}` : `${v > 0 ? "+" : ""}${v}% vs ${mesCurto(mesAnt)}.`;
  return { cor, texto, pct: Math.min(100, c.anterior > 0 ? (c.total / c.anterior) * 100 : 100) };
}

export function maisPesou(cats: CategoriaRX[], n = 3): CategoriaRX[] {
  return cats.filter((c) => !FORA_DO_PESO.has(c.categoria) && c.total > 0).sort((a, b) => b.total - a.total).slice(0, n);
}

export function aplicarFiltros(lista: LancamentoRX[], f: Filtros): LancamentoRX[] {
  const q = f.texto.trim().toLowerCase();
  return lista.filter((l) => {
    const entre = l.movimento === "entre_contas";
    if (f.transferencias !== entre) return false;
    if (q && !`${l.descricao} ${l.comerciante ?? ""} ${l.banco ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.bancos.length && !f.bancos.includes(l.banco ?? "")) return false;
    if (f.categorias.length && !f.categorias.includes(l.categoria)) return false;
    if (f.esfera && l.esfera !== f.esfera) return false;
    if (f.tipo && l.tipo !== f.tipo) return false;
    if (f.identificacao === "nao" && l.categoria !== "nao_identificado") return false;
    if (f.identificacao === "sim" && l.categoria === "nao_identificado") return false;
    if (f.min != null && l.valor < f.min) return false;
    if (f.max != null && l.valor > f.max) return false;
    return true;
  });
}

/** How many filters are on (for the chip counter). */
export function contarFiltros(f: Filtros): number {
  return (f.bancos.length ? 1 : 0) + (f.categorias.length ? 1 : 0) + (f.esfera ? 1 : 0) + (f.tipo ? 1 : 0)
    + (f.transferencias ? 1 : 0) + (f.identificacao ? 1 : 0) + (f.min != null || f.max != null ? 1 : 0);
}

/** "Onde mais foi": top recipients of a category. */
export function destinatarios(lista: LancamentoRX[], n = 3): { nome: string; total: number; qtd: number }[] {
  const m = new Map<string, { nome: string; total: number; qtd: number }>();
  for (const l of lista) {
    const nome = (l.comerciante || l.descricao || "Sem nome").trim();
    const k = nome.toUpperCase();
    const x = m.get(k) ?? { nome, total: 0, qtd: 0 };
    x.total += l.valor; x.qtd += 1;
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, n);
}

export const nomeDestinatario = (l: LancamentoRX) => (l.comerciante || l.descricao || "Sem nome").trim();
