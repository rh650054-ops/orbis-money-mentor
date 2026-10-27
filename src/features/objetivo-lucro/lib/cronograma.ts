/* ============================================================
   CRONOGRAMA DA MISSÃO (Rick, 27/10/2026) — pure math.
   Turns "R$ 5.000 in 15 days, working N of them" into a day-by-day plan:
   which calendar days to work (his strongest weekdays first), how many units,
   how much revenue and how much merchandise each day — plus the cumulative
   profit curve against the target. Balanced: 60% proportional to how strong
   the weekday is for him, 40% flat, so no single day carries the mission.
   ============================================================ */
import type { BaseLucro } from "../types";

/** Forecast for one day of the mission (from the weather screen's 7-day forecast). */
export interface ClimaDia { tipo: "seco" | "garoa" | "chuva"; prob: number; codigo: number | null; max: number | null }
/** How the weather enters the plan: forecast by date + how much a rainy day costs him. */
export interface ClimaPlano { previsao: Map<string, ClimaDia>; fator: number }

export interface DiaPlano {
  data: string;         // yyyy-mm-dd
  dow: number;
  trabalha: boolean;
  forte: boolean;
  unid: number;
  faturamento: number;
  mercadoria: number;
  lucro: number;
  acumulado: number;    // profit so far at the end of this day
  acumuladoMedia: number; // what his average pace would have reached
  atendimentos: number; // sales (people served) ≈ units ÷ units per sale (combos)
  calote: number;       // reserve for calote that day
  estoqueFim: number;   // ready stock left after the day (negative = had to produce)
  clima: ClimaDia | null; // forecast for the day, when it is within the 7-day window
}

export interface Cronograma {
  dias: DiaPlano[];
  totalUnid: number;
  faturamentoTotal: number;
  mercadoriaTotal: number;
  caloteReserva: number;
  lucroTotal: number;
  maiorDia: number;
  menorDia: number;
  /** last day the current stock covers fully (null = covers the whole mission) */
  estoqueAte: string | null;
  /** first work day that needs new production */
  produzirAte: string | null;
  /** work days with real rain in the forecast (units already moved to dry days) */
  diasChuva: string[];
  /** forecast rainy days the plan left as days off */
  chuvaEvitada: string[];
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function cronograma(b: BaseLucro, alvo: number, dias: number, diasTrabalho: number, inicio: Date, clima?: ClimaPlano): Cronograma {
  const n = Math.max(1, Math.min(90, Math.round(dias)));
  const trabalho = Math.max(1, Math.min(n, Math.round(diasTrabalho)));
  const lucroUnid = Math.max(0, b.ticket - b.custo_unid);
  const forca = new Map(b.semana.map((s) => [s.dow, s.unid_dia]));
  const media = b.unid_dia > 0 ? b.unid_dia : 1;

  const cal = Array.from({ length: n }, (_, i) => {
    const d = new Date(inicio); d.setDate(d.getDate() + i);
    const data = ymd(d);
    const prev = clima?.previsao.get(data) ?? null;
    // Rain cuts the day by his own factor (rain days sell ~66% of a dry day for Rick); drizzle a little.
    const efeito = !prev ? 1 : prev.tipo === "chuva" ? (clima?.fator ?? 0.7) : prev.tipo === "garoa" ? (1 + (clima?.fator ?? 0.7)) / 2 : 1;
    return { data, dow: d.getDay(), peso: (forca.get(d.getDay()) ?? media * 0.6) * efeito, base: forca.get(d.getDay()) ?? media * 0.6, prev };
  });
  // Pick the work days: the strongest weekdays first, ties to the earliest date.
  const escolhidos = new Set([...cal].sort((a, z) => z.peso - a.peso || a.data.localeCompare(z.data)).slice(0, trabalho).map((c) => c.data));
  const totalUnid = lucroUnid > 0 ? Math.ceil(alvo / lucroUnid) : 0;
  const somaPeso = cal.filter((c) => escolhidos.has(c.data)).reduce((s, c) => s + c.peso, 0) || 1;
  const flat = totalUnid / trabalho;

  let acumulado = 0; let acumuladoMedia = 0; let distribuido = 0; let i = 0; let estoque = b.estoque;
  const porVenda = b.combos.unid_por_venda > 0 ? b.combos.unid_por_venda : 1;
  const lucroMediaDia = media * lucroUnid;
  const dias_: DiaPlano[] = cal.map((c) => {
    const trabalha = escolhidos.has(c.data);
    let unid = 0;
    if (trabalha) {
      i += 1;
      // Balanced: half by how strong the weekday is, half flat; never above his record.
      const alvoDia = 0.5 * (totalUnid * c.peso / somaPeso) + 0.5 * flat;
      unid = i === trabalho ? Math.max(0, totalUnid - distribuido) : Math.round(b.recorde_dia > 0 ? Math.min(b.recorde_dia, alvoDia) : alvoDia);
      distribuido += unid;
      acumuladoMedia += lucroMediaDia;
    }
    const lucro = unid * lucroUnid;
    acumulado += lucro;
    estoque -= unid;
    return {
      data: c.data, dow: c.dow, trabalha, forte: c.base >= media, unid, clima: c.prev,
      faturamento: unid * b.ticket, mercadoria: unid * b.custo_receita, lucro, acumulado, acumuladoMedia,
      atendimentos: Math.ceil(unid / porVenda), calote: unid * b.calote_unid, estoqueFim: estoque,
    };
  });
  const uTrab = dias_.filter((d) => d.trabalha).map((d) => d.unid);
  const falta = dias_.find((d) => d.trabalha && d.estoqueFim < 0);
  const coberto = [...dias_].reverse().find((d) => d.trabalha && d.estoqueFim >= 0 && (!falta || d.data < falta.data));
  return {
    dias: dias_,
    totalUnid,
    faturamentoTotal: totalUnid * b.ticket,
    mercadoriaTotal: totalUnid * b.custo_receita,
    caloteReserva: totalUnid * b.calote_unid,
    lucroTotal: totalUnid * lucroUnid,
    maiorDia: uTrab.length ? Math.max(...uTrab) : 0,
    menorDia: uTrab.length ? Math.min(...uTrab) : 0,
    estoqueAte: falta ? coberto?.data ?? null : null,
    produzirAte: falta?.data ?? null,
    diasChuva: dias_.filter((d) => d.trabalha && d.clima?.tipo === "chuva").map((d) => d.data),
    chuvaEvitada: dias_.filter((d) => !d.trabalha && d.clima?.tipo === "chuva").map((d) => d.data),
  };
}
