/* ============================================================
   META VIÁVEL (Rick, 11/10/2026)
   O sonho do mês (monthly_goal) continua sendo o norte. A meta de CADA DIA
   nasce de duas coisas:
     • precisa/dia  = (sonho − vendido no mês) ÷ dias de trabalho que faltam
     • ritmo        = o que ele faz de verdade nesse dia da semana (mediana das
                      últimas semanas, misturada com a mediana geral dos últimos
                      14 dias trabalhados, pra amostra pequena não mandar sozinha)
   Meta do dia = precisa/dia, travada entre o ritmo e 1,3× o ritmo. Acima disso
   o mês está inviável no ritmo atual: a meta vira 1,3× o ritmo e o app oferece
   replanejar (baixar o mês, trabalhar mais um dia, ou manter).
   Faixas: Mínimo 80% · Meta 100% · Turbo 120%.
   Puro: sem React, sem banco. Datas em "YYYY-MM-DD" (fuso BR já resolvido).
   ============================================================ */

export interface DiaHistorico { date: string; vendido: number }
export interface PerfilMeta {
  metaMensal: number;
  /** nomes em inglês minúsculo, como profiles.working_days ("thursday"…) */
  diasTrabalho: string[];
  /** fallback pra conta nova (profiles.base_daily_goal) */
  metaBase: number;
}
export type StatusMes = "aprendendo" | "folga" | "no_ritmo" | "apertado" | "inviavel";

export interface MetaDoDia {
  hoje: string;
  diaSemana: number;
  /** o que ele faz de verdade nesse dia da semana */
  ritmo: number;
  /** quantos dias desse dia da semana entraram na conta */
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
  /** mês que fecharia no ritmo turbo (1,2×) nos dias que faltam */
  mesViavel: number;
  /** precisa/dia se ele trabalhar mais um dia por semana */
  precisaComMaisUmDia: number | null;
  /** dia da semana (0–6) que entraria como +1 */
  maisUmDia: number | null;
}

export const NOMES_DIA = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export const DIAS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

const r10 = (n: number) => Math.round(n / 10) * 10;
const r100 = (n: number) => Math.round(n / 100) * 100;

export function mediana(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : (((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2);
}

/** "YYYY-MM-DD" → dia da semana sem passar por fuso */
export function diaSemanaDe(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}
export function somarDias(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
}
function ultimoDiaDoMes(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).toISOString().slice(0, 10);
}

/** Dias de trabalho de `de` (inclusive) até o fim do mês. */
export function diasDeTrabalhoRestantes(de: string, diasTrabalho: string[], incluirHoje = true): number {
  const fim = ultimoDiaDoMes(de);
  const set = new Set(diasTrabalho.map((d) => d.toLowerCase()));
  let n = 0;
  for (let d = incluirHoje ? de : somarDias(de, 1); d <= fim; d = somarDias(d, 1)) {
    if (set.has(NOMES_DIA[diaSemanaDe(d)] ?? "")) n++;
  }
  return n;
}

/** Ritmo do dia da semana: mediana do mesmo dia nas últimas 8 semanas, misturada com a geral. */
export function ritmoDoDia(historico: DiaHistorico[], hoje: string, metaBase: number): { ritmo: number; amostraDia: number; aprendendo: boolean } {
  const desde = somarDias(hoje, -56);
  const trabalhados = historico.filter((h) => h.vendido > 0 && h.date < hoje && h.date >= desde)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (trabalhados.length < 3) return { ritmo: r10(Math.max(50, metaBase)), amostraDia: 0, aprendendo: true };
  const geral = mediana(trabalhados.slice(0, 14).map((h) => h.vendido));
  const dow = diaSemanaDe(hoje);
  const doDia = trabalhados.filter((h) => diaSemanaDe(h.date) === dow).slice(0, 6).map((h) => h.vendido);
  const ritmo = doDia.length >= 3
    ? 0.6 * mediana(doDia) + 0.4 * geral
    : doDia.length > 0 ? 0.3 * mediana(doDia) + 0.7 * geral : geral;
  return { ritmo: r10(Math.max(50, ritmo)), amostraDia: doDia.length, aprendendo: false };
}

export function metaDoDia(args: { hoje: string; historico: DiaHistorico[]; perfil: PerfilMeta; vendidoMes: number; vendidoHoje?: number }): MetaDoDia {
  const { hoje, historico, perfil } = args;
  const vendidoHoje = args.vendidoHoje ?? 0;
  const { ritmo, amostraDia, aprendendo } = ritmoDoDia(historico, hoje, perfil.metaBase);
  const dias = perfil.diasTrabalho.length ? perfil.diasTrabalho : [...NOMES_DIA].filter((_, i) => i !== 0);
  const hojeTrabalha = dias.map((d) => d.toLowerCase()).includes(NOMES_DIA[diaSemanaDe(hoje)] ?? "");
  // hoje conta como dia que falta (a meta de hoje faz parte do plano)
  const diasRestantes = Math.max(hojeTrabalha ? 1 : 0, diasDeTrabalhoRestantes(hoje, dias, hojeTrabalha));
  const vendidoAntesDeHoje = Math.max(0, args.vendidoMes - vendidoHoje);
  const faltaMes = Math.max(0, perfil.metaMensal - vendidoAntesDeHoje);
  const precisaDia = diasRestantes > 0 ? r10(faltaMes / diasRestantes) : 0;

  let status: StatusMes;
  let meta: number;
  if (aprendendo) { status = "aprendendo"; meta = precisaDia > 0 ? Math.min(precisaDia, r10(ritmo * 1.3)) : ritmo; }
  else if (precisaDia <= ritmo) { status = "folga"; meta = ritmo; }
  else if (precisaDia <= ritmo * 1.1) { status = "no_ritmo"; meta = precisaDia; }
  else if (precisaDia <= ritmo * 1.3) { status = "apertado"; meta = precisaDia; }
  else { status = "inviavel"; meta = r10(ritmo * 1.3); }
  if (faltaMes <= 0 && !aprendendo) { status = "folga"; meta = ritmo; }

  // "+1 dia por semana": o primeiro dia de folga mais perto de um dia que ele já trabalha
  let maisUmDia: number | null = null;
  let precisaComMaisUmDia: number | null = null;
  const setDias = new Set(dias.map((d) => d.toLowerCase()));
  for (const cand of [5, 6, 0, 4, 3, 2, 1]) {
    if (!setDias.has(NOMES_DIA[cand] ?? "")) { maisUmDia = cand; break; }
  }
  if (maisUmDia !== null) {
    const comMais = [...dias, NOMES_DIA[maisUmDia] ?? ""];
    const n = Math.max(1, diasDeTrabalhoRestantes(hoje, comMais, true));
    precisaComMaisUmDia = r10(faltaMes / n);
  }

  return {
    hoje, diaSemana: diaSemanaDe(hoje), ritmo, amostraDia, precisaDia, diasRestantes,
    vendidoMes: args.vendidoMes, metaMensal: perfil.metaMensal, faltaMes,
    meta, minimo: r10(meta * 0.8), turbo: r10(meta * 1.2), status,
    mesViavel: r100(vendidoAntesDeHoje + ritmo * 1.2 * diasRestantes),
    precisaComMaisUmDia, maisUmDia,
  };
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

export function textoStatus(m: MetaDoDia): string {
  switch (m.status) {
    case "aprendendo": return "a Vant ainda está aprendendo seu ritmo";
    case "folga": return "você está adiantado no mês";
    case "no_ritmo": return "no seu ritmo";
    case "apertado": return "acima do seu ritmo, mas dá";
    case "inviavel": return "fora do seu ritmo";
  }
}
