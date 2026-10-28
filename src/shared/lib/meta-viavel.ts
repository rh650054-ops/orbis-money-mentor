/* ============================================================
   META VIÁVEL (Rick, 11/10/2026)
   A CONTA mora no servidor: vant_meta_calcular() roda no cérebro noturno e
   grava metas_dia (migration 20261011050000). O app lê por meta_do_dia() e
   replaneja por meta_replanejar(). Aqui ficam só o tipo, a leitura da linha
   e os ajudantes de tela (faixas, blocos pela curva, textos).

   Resumo da regra (a fonte é o SQL):
     ritmo   = o que ele faz nesse dia da semana (mediana, misturada com a geral)
     precisa = (sonho − vendido no mês) ÷ dias de trabalho que faltam
     meta    = precisa, travada entre o ritmo (folga) e 1,3× o ritmo (inviável)
     faixas  = Mínimo 80% · Meta 100% · Turbo 120%
     máximo  = dias de folga + até 2 blocos a mais, até chegar no sonho (≤ 6 dias/semana)
     realista= ritmo turbo (1,2×) nos dias que já trabalha
   Conta nova: 'aprendendo' (meta manual) até o 1º dia vendido.

   25/10/2026 — dois modos (profiles.meta_adaptativa):
     padrão     = meta é o que falta do mês ÷ dias de trabalho que faltam, sem trava.
                  Um número só (sem Mínimo/Turbo). Todo mundo começa aqui.
     adaptativo = a regra de cima (pelo ritmo) com as três faixas. Liga no Foco,
                  oferecido a partir do 3º dia vendido (DIAS_PRA_ADAPTATIVA).
   O status continua calculado nos dois: é o que oferece o replanejamento.
   ============================================================ */

export type StatusMes = "aprendendo" | "folga" | "no_ritmo" | "apertado" | "inviavel";
export type ModoMeta = "padrao" | "adaptativo";
/** dias vendidos antes de a Vant oferecer a meta adaptativa */
export const DIAS_PRA_ADAPTATIVA = 3;

export interface PlanoMaximo {
  diasExtra: string[];
  blocos: number;
  metaDia: number;
  diasRestantes: number;
  projecao: number;
  pct: number;
  chega: boolean;
  vendasDia: number | null;
  vendasHora: number | null;
  vendasDiaRealista: number | null;
}

export interface MetaDoDia {
  hoje: string;
  diaSemana: number;
  ritmo: number;
  amostraDia: number;
  precisaDia: number;
  diasRestantes: number;
  vendidoMes: number;
  metaMensal: number;
  faltaMes: number;
  meta: number;
  minimo: number;
  turbo: number;
  status: StatusMes;
  mesViavel: number;
  ticket: number | null;
  maximo: PlanoMaximo | null;
  curva: number[];
  /** padrão = a meta dele (planejamento); adaptativo = pelo ritmo, com faixas */
  modo: ModoMeta;
  /** meta pelo ritmo (a do modo adaptativo), pra mostrar na oferta */
  metaAdaptativa: number;
  /** dias com venda nas últimas 8 semanas */
  diasVendidos: number;
  /** 28/10: active profit mission — the day's goal above is what it needs today */
  missao: MissaoHoje | null;
}

/** What the active profit mission asks for today (metas_dia.missao). */
export interface MissaoHoje {
  alvo: number;
  fim: string;
  precisaLucro: number;
  unidMeta: number;
  faturar: number;
  produto: string | null;
}

function lerMissao(v: unknown): MissaoHoje | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  if (!(Number(m.unid_meta) > 0)) return null;
  return {
    alvo: n(m.alvo), fim: String(m.fim ?? ""), precisaLucro: n(m.precisa_lucro),
    unidMeta: Number(m.unid_meta), faturar: n(m.faturar),
    produto: typeof m.produto === "string" && m.produto.trim() ? m.produto.trim() : null,
  };
}

export const NOMES_DIA = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export const DIAS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
export const diaPt = (nome: string) => DIAS_PT[NOMES_DIA.indexOf(nome.toLowerCase() as typeof NOMES_DIA[number])] ?? nome;

/** "YYYY-MM-DD" → dia da semana sem passar por fuso */
export function diaSemanaDe(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

const n = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;
const STATUS: StatusMes[] = ["aprendendo", "folga", "no_ritmo", "apertado", "inviavel"];

/** Linha de metas_dia (como vem do RPC) → MetaDoDia. Null se não veio nada. */
export function lerMetaDoDia(row: unknown): MetaDoDia | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (!r.dia) return null;
  const pm = (r.plano_maximo && typeof r.plano_maximo === "object" ? r.plano_maximo : null) as Record<string, unknown> | null;
  const status = STATUS.includes(r.status as StatusMes) ? (r.status as StatusMes) : "aprendendo";
  return {
    hoje: String(r.dia), diaSemana: diaSemanaDe(String(r.dia)),
    ritmo: n(r.ritmo), amostraDia: Number(r.amostra_dia) || 0, precisaDia: n(r.precisa_dia),
    diasRestantes: Number(r.dias_restantes) || 0, vendidoMes: n(r.vendido_mes), metaMensal: n(r.meta_mensal),
    faltaMes: n(r.falta_mes), meta: n(r.meta), minimo: n(r.minimo), turbo: n(r.turbo), status,
    mesViavel: n(r.mes_viavel), ticket: r.ticket === null || r.ticket === undefined ? null : n(r.ticket),
    maximo: pm ? {
      diasExtra: Array.isArray(pm.dias_extra) ? pm.dias_extra.map(String) : [],
      blocos: Number(pm.blocos) || 0, metaDia: n(pm.meta_dia), diasRestantes: Number(pm.dias_restantes) || 0,
      projecao: n(pm.projecao), pct: Number(pm.pct) || 0, chega: Boolean(pm.chega),
      vendasDia: pm.vendas_dia == null ? null : Number(pm.vendas_dia),
      vendasHora: pm.vendas_hora == null ? null : Number(pm.vendas_hora),
      vendasDiaRealista: pm.vendas_dia_realista == null ? null : Number(pm.vendas_dia_realista),
    } : null,
    curva: Array.isArray(r.curva) ? r.curva.map((x) => Number(x) || 0) : [],
    modo: r.modo === "adaptativo" ? "adaptativo" : "padrao",
    metaAdaptativa: r.meta_adaptativa == null ? n(r.meta) : n(r.meta_adaptativa),
    diasVendidos: Number(r.dias_vendidos) || 0,
    missao: lerMissao(r.missao),
  };
}

/** Faixas Mínimo · Meta · Turbo só no modo adaptativo, com ritmo conhecido. */
export function mostraFaixas(m: MetaDoDia | null): boolean {
  return !!m && m.modo === "adaptativo" && m.status !== "aprendendo" && m.meta > 0;
}

/** A Vant já tem como analisar: oferece (ou mostra) a meta adaptativa. */
export function ofereceAdaptativa(m: MetaDoDia | null): boolean {
  return !!m && (m.modo === "adaptativo" || m.diasVendidos >= DIAS_PRA_ADAPTATIVA);
}

/** Quantas vendas cabem num valor, pelo ticket médio. Null sem ticket. */
export function vendasPara(valor: number, ticket: number | null | undefined): number | null {
  if (!ticket || ticket <= 0 || !(valor > 0)) return null;
  return Math.max(1, Math.ceil(valor / ticket));
}

/** Faixa que o vendido de hoje já alcançou. */
export function faixaAtingida(vendido: number, m: Pick<MetaDoDia, "minimo" | "meta" | "turbo">): "nenhuma" | "minimo" | "meta" | "turbo" {
  if (vendido >= m.turbo) return "turbo";
  if (vendido >= m.meta) return "meta";
  if (vendido >= m.minimo) return "minimo";
  return "nenhuma";
}

/** Divide a meta pelos blocos de hora seguindo a curva real dele (média por bloco). Sem curva: igual. */
export function metaPorBloco(meta: number, blocos: number, curva: number[]): number[] {
  const n = Math.max(1, blocos);
  const pesos = Array.from({ length: n }, (_, i) => Math.max(0, curva[i] ?? 0));
  const soma = pesos.reduce((a, b) => a + b, 0);
  if (soma <= 0) return Array.from({ length: n }, () => Math.round((meta / n) * 100) / 100);
  // piso de 40% da média: hora fraca ainda tem alvo
  const media = soma / n;
  const ajust = pesos.map((p) => Math.max(p, media * 0.4));
  const s2 = ajust.reduce((a, b) => a + b, 0);
  return ajust.map((p) => Math.round(((p / s2) * meta) * 100) / 100);
}

export function textoStatus(m: Pick<MetaDoDia, "status">): string {
  switch (m.status) {
    case "aprendendo": return "a Vant ainda está aprendendo seu ritmo";
    case "folga": return "você está adiantado no mês";
    case "no_ritmo": return "no seu ritmo";
    case "apertado": return "acima do seu ritmo, mas dá";
    case "inviavel": return "fora do seu ritmo";
  }
}

/** "quarta e segunda" */
export function listarDias(nomes: string[]): string {
  const ds = nomes.map(diaPt);
  if (ds.length <= 1) return ds[0] ?? "";
  return `${ds.slice(0, -1).join(", ")} e ${ds[ds.length - 1]}`;
}
