import type { RaioXVilao } from "@/hooks/useRaioXExtrato";
import { formatCurrency } from "@/shared/lib/utils";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-09-01" -> "setembro" (curto: "set"). */
export function mesNome(mesIso: string, curto = false): string {
  const idx = Number(mesIso.slice(5, 7)) - 1;
  const nome = MESES[idx] ?? mesIso;
  return curto ? nome.slice(0, 3) : nome;
}

/** Primeiro dia do mês atual no fuso BR, "YYYY-MM-01". */
export function mesAtualIso(): string {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return `${hoje.slice(0, 7)}-01`;
}

export function mesAnteriorIso(mesIso: string): string {
  const y = Number(mesIso.slice(0, 4)); const m = Number(mesIso.slice(5, 7));
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** "2026-09-27" -> { dia: "27", sem: "sáb" } */
export function diaCurto(dataIso: string): { dia: string; sem: string } {
  const d = new Date(`${dataIso}T12:00:00`);
  return { dia: dataIso.slice(8, 10), sem: DIAS[d.getDay()] ?? "" };
}

/** Sem centavos quando o valor é grande — a tela fica mais limpa. */
export function moeda(v: number): string {
  if (Math.abs(v) >= 1000) return `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
  return formatCurrency(v);
}

/** Variação vs mês anterior, já em texto curto. null quando não tem base de comparação. */
export function variacao(atual: number, anterior: number): { texto: string; sobe: boolean } | null {
  if (anterior <= 0 || atual <= 0) return null;
  const r = atual / anterior;
  if (r >= 1.9) return { texto: `▲ ${r >= 2.9 ? "3×" : "2×"} vs mês passado`, sobe: true };
  const pct = Math.round((r - 1) * 100);
  if (Math.abs(pct) < 3) return { texto: "= mês passado", sobe: false };
  return { texto: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`, sobe: pct > 0 };
}

/** Frase do vilão — só com números que vieram do banco (nada inventado). */
export function fraseVilao(v: RaioXVilao, mesAnteriorNome: string): string {
  const partes: string[] = [];
  const unidade = v.categoria === "delivery" ? "pedidos" : v.categoria === "transporte_app" ? "corridas" : v.categoria === "pix_pessoas" ? "Pix" : "vezes";
  const singular: Record<string, string> = { pedidos: "pedido", corridas: "corrida", Pix: "Pix", vezes: "vez" };
  partes.push(`${moeda(v.total)} em ${v.qtd} ${v.qtd === 1 ? singular[unidade] ?? unidade : unidade}`);
  if (v.anterior > 0) {
    const r = v.total / v.anterior;
    if (r >= 1.9) partes.push(`— ${r >= 2.9 ? "o triplo" : "o dobro"} de ${mesAnteriorNome}`);
    else if (r >= 1.15) partes.push(`— ${moeda(v.total - v.anterior)} a mais que em ${mesAnteriorNome}`);
    else if (r <= 0.85) partes.push(`— ${moeda(v.anterior - v.total)} a menos que em ${mesAnteriorNome}`);
  }
  let frase = `${partes.join(" ")}.`;
  if (v.qtd > 1 && v.media > 0) frase += ` Dá ${moeda(v.media)} cada.`;
  if (v.top_comerciante && v.top_qtd && v.top_total && v.qtd > 1 && v.top_qtd < v.qtd) {
    const nome = v.top_comerciante.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
    frase += v.categoria === "pix_pessoas"
      ? ` Só pra ${nome} foram ${moeda(v.top_total)} em ${v.top_qtd} ${v.top_qtd === 1 ? "vez" : "vezes"}.`
      : ` ${v.top_qtd} d${v.qtd === 1 ? "e" : "os"} ${v.qtd} em ${nome}.`;
  }
  if (v.madrugada > 0 && v.qtd > 0) frase += ` ${v.madrugada} ${v.madrugada === 1 ? "foi" : "foram"} de madrugada.`;
  return frase;
}

export const COR_CAT: Record<string, string> = {
  mercadoria: "#FFC800", insumos: "#FFC800", onibus: "#3DD68C", combustivel: "#3DD68C",
  transporte_app: "#FF8A3D", delivery: "#FF5A45", restaurante: "#FF8A3D", mercado: "#4FA3FF",
  pix_pessoas: "#B07CFF", assinaturas: "#8a8378", contas_casa: "#4FA3FF", celular_internet: "#4FA3FF",
  farmacia: "#3DD68C", roupas: "#B07CFF", lazer: "#B07CFF", parcelas: "#FF5A45", saque: "#8a8378",
  taxas: "#FF5A45", apostas: "#FF5A45", transferencia_propria: "#8a8378", outros: "#8a8378", nao_identificado: "#8a8378",
  fatura_cartao: "#FF8A3D", impostos: "#FFC800",
};

/** "MOHAMED NACIF" -> "Mohamed Nacif" */
export const bonito = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
export const corCat = (slug: string) => COR_CAT[slug] ?? "#8a8378";

/** "1.234,56" / "1234,5" / "12.50" / "2.000" -> número. Ponto seguido de 3 dígitos = milhar. */
export function lerValor(s: string): number {
  const t = s.trim().replace(/[^\d.,]/g, "");
  const br = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /\.\d{3}(\D|$)/.test(t) ? t.replace(/\./g, "") : t;
  return Math.round((Number(br) || 0) * 100) / 100;
}
