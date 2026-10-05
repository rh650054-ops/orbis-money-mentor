/* ABA ANÁLISE — tipos e regras de leitura (05/10/2026, redesenho).
   Os números vêm de financas_rastreador(p_mes) / analise_revisar / analise_lancamentos.
   Regra de ouro: toda barra diz contra o QUÊ está comparando (Teto, Ritmo ou Média). */
import { formatCurrency } from "@/shared/lib/utils";
import { COR } from "../planejar/ui";

export interface CatAnalise {
  categoria: string; rotulo: string; total: number; qtd: number;
  normal: number;        // teto (se tiver) ou média mensal
  esperado: number;      // quanto costuma ter saído até hoje (curva do histórico)
  fixa: boolean; tem_teto: boolean; historico: number; passado_mesmo_dia: number;
}
export interface Alerta { categoria: string; rotulo: string; total: number; esperado: number; acima: number }
export interface Negocio { total: number; media_mensal: number; categorias: { categoria: string; rotulo: string; total: number; qtd: number }[] }
export interface Analise {
  tem_dados: boolean; mes: string; corrente: boolean; dia: number; dias_mes: number;
  meses_historico?: number; gasto?: number; qtd?: number; mes_passado_mesmo_dia?: number;
  normal_mes?: number; media_mensal?: number; normal_ate_hoje?: number; projecao?: number | null;
  categorias?: CatAnalise[]; tem_tetos?: boolean; alertas?: Alerta[]; negocio?: Negocio;
}
export interface Pendente { id: string; data: string; valor: number; nome: string; banco: string | null; categoria: string }
export interface Revisao { pendentes: Pendente[]; total_pendentes: number; organizados: number; perguntas: number }
export interface Lancamento {
  id: string; data: string; hora: string | null; nome: string; original: string; apelido: string | null;
  valor: number; categoria: string; banco: string | null; recorrente: boolean; fora_analise: boolean;
  confirmado: boolean; mesmo_nome: number;
}
export interface CategoriaDef { slug: string; rotulo: string; tipo: string; esfera_padrao: string; ordem: number }

/** Categoria aberta no detalhe: uma categoria pessoal ou o bloco "custos do negócio". */
export type Aberta = { tipo: "categoria"; cat: CatAnalise } | { tipo: "negocio"; negocio: Negocio };

/** O que a Vant não sabe o que é: vai pro "Para revisar", não vira alerta. */
export const A_REVISAR = new Set(["pix_pessoas", "nao_identificado"]);

export const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");
export const nomeMes = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
export const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function somaMes(iso: string, n: number) {
  const d = new Date(`${iso.slice(0, 7)}-01T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const LARANJA = "#FF9F43";

export interface Referencia { metrica: "Teto" | "Ritmo" | "Média" | null; texto: string; curto: string; pct: number; cor: string }
const inteiro = (v: number) => reais(Math.round(v));

/**
 * Contra o que a barra compara:
 *  • com teto → gasto × teto do mês;
 *  • conta fixa sem teto → gasto × média mensal (cai de uma vez, ritmo não faz sentido);
 *  • o resto → gasto × ritmo (quanto costuma ter saído até hoje).
 * Cor = estado: verde saudável, amarelo atenção, laranja perto do limite, vermelho passou.
 */
export function referencia(c: CatAnalise, corrente: boolean): Referencia {
  const cor = (r: number, limites: [number, number, number]) =>
    r > limites[2] ? COR.coral : r > limites[1] ? LARANJA : r > limites[0] ? COR.ouro : COR.verde;
  if (c.tem_teto && c.normal > 0) {
    const r = c.total / c.normal;
    return { metrica: "Teto", texto: `de ${reais(c.normal)}`, curto: `Teto ${inteiro(c.normal)}`, pct: r * 100, cor: cor(r, [0.7, 0.9, 1]) };
  }
  if (c.fixa && c.normal > 0) {
    const r = c.total / c.normal;
    return { metrica: "Média", texto: `média mensal ${reais(c.normal)}`, curto: `Média ${inteiro(c.normal)}`, pct: r * 100, cor: cor(r, [0.9, 1.05, 1.15]) };
  }
  if (c.esperado > 0) {
    const r = c.total / c.esperado;
    return { metrica: "Ritmo", texto: corrente ? `ritmo ${reais(c.esperado)} até hoje` : `média ${reais(c.esperado)}`, curto: `${corrente ? "Ritmo" : "Média"} ${inteiro(c.esperado)}`, pct: r * 100, cor: cor(r, [0.9, 1.1, 1.3]) };
  }
  return { metrica: null, texto: c.historico > 0 ? `média ${reais(c.historico)}` : "novo este mês", curto: c.historico > 0 ? `Média ${inteiro(c.historico)}` : "novo este mês", pct: 0, cor: COR.mute };
}

/** O alerta não repete a categoria que já abre a lista "onde você gastou". */
export function escolherAlerta(alertas: Alerta[], primeira: string | undefined): Alerta | null {
  return alertas.find((a) => a.categoria !== primeira) ?? null;
}

/** Diferença do mês contra o ritmo esperado (null = sem histórico pra comparar). */
export function ritmo(a: Analise): { dif: number; estado: "abaixo" | "acima" | "igual" } | null {
  const esperado = a.normal_ate_hoje ?? 0;
  if (!a.meses_historico || esperado <= 0) return null;
  const dif = (a.gasto ?? 0) - esperado;
  const estado = Math.abs(dif) <= esperado * 0.03 ? "igual" : dif > 0 ? "acima" : "abaixo";
  return { dif, estado };
}
