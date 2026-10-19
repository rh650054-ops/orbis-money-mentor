import type { Periodo, Preset } from "../types";

/** Today as YYYY-MM-DD in the Brazil calendar (same rule as date-utils, without its
 *  supabase import so this file stays pure and testable). */
export function hojeBR(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Calendar arithmetic on YYYY-MM-DD strings (no timezone drift). */
export function addDias(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function diasEntre(de: string, ate: string): number {
  const a = Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10));
  const b = Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10));
  return Math.round((b - a) / 86_400_000) + 1;
}

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD in the Brazil calendar. */
export function diaDaSemana(iso: string): number {
  return new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay();
}

const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;
const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const semanaCurta = (iso: string) => SEMANA_CURTA[diaDaSemana(iso)]!;
export const semanaLonga = (iso: string) => SEMANA_LONGA[diaDaSemana(iso)]!;

/**
 * Period for a chip. "Semana" is the last 7 days ending today,
 * "Mês" is day 1 → today; "7d"/"30d" are rolling windows ending today.
 * Rick (18/10): "o vendedor de rua está sempre querendo olhar ontem" — so "ontem"
 * is a first-class chip, not a custom range.
 */
export function periodoDoPreset(preset: Preset, hoje = hojeBR(), custom?: { de: string; ate: string }): Periodo {
  switch (preset) {
    case "hoje": return { preset, de: hoje, ate: hoje };
    case "ontem": { const d = addDias(hoje, -1); return { preset, de: d, ate: d }; }
    // Rick (19/10): "Semana" são os últimos 7 dias, não segunda → hoje (na segunda-feira
    // a semana de calendário só tinha o dia de hoje e o relatório aparecia zerado).
    case "semana": return { preset, de: addDias(hoje, -6), ate: hoje };
    case "mes": return { preset, de: hoje.slice(0, 7) + "-01", ate: hoje };
    case "7d": return { preset, de: addDias(hoje, -6), ate: hoje };
    case "30d": return { preset, de: addDias(hoje, -29), ate: hoje };
    case "custom": {
      const de = custom?.de ?? addDias(hoje, -6);
      const ate = custom?.ate ?? hoje;
      return de <= ate ? { preset, de, ate } : { preset, de: ate, ate: de };
    }
  }
}

export const ehUmDia = (p: Periodo) => p.de === p.ate;

/** "12/10 → 18/10", or "sábado 18/10" for a single day. */
export function rotuloPeriodo(p: Periodo): string {
  if (ehUmDia(p)) return `${semanaLonga(p.de)} ${ddmm(p.de)}`;
  return `${ddmm(p.de)} → ${ddmm(p.ate)}`;
}

/** What "anterior" means for this period, in the vendor's words. */
export function rotuloAnterior(p: Periodo): string {
  switch (p.preset) {
    case "hoje": return "ontem";
    case "ontem": return "anteontem";
    case "semana": return "7 dias anteriores";
    case "mes": return "mês anterior";
    default: return "período anterior";
  }
}

/** Title of the money card: "Dinheiro de hoje", "Dinheiro da semana"… */
export function tituloDinheiro(p: Periodo): string {
  switch (p.preset) {
    case "hoje": return "Dinheiro de hoje";
    case "ontem": return "Dinheiro de ontem";
    case "semana": return "Dinheiro da semana";
    case "mes": return "Dinheiro do mês";
    default: return "Dinheiro do período";
  }
}

/** Minutes → "3h11", "45min", "0min". */
export function fmtMin(min: number): string {
  const m0 = Math.max(0, Math.round(min || 0));
  if (m0 < 60) return `${m0}min`;
  const h = Math.floor(m0 / 60);
  const m = m0 % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** Decimal minutes → "8min52s" (for "1 venda a cada …"). */
export function fmtMinSeg(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  const total = Math.round(min * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) return fmtMin(m);
  return s > 0 ? `${m}min${String(s).padStart(2, "0")}s` : `${m}min`;
}

/** BRL the way the screen shows it: whole reais by default ("R$ 3.892"), cents only
 *  where they matter (ticket, "de cada R$ 10"). */
export function brl(v: number, centavos = false): string {
  const digits = centavos ? 2 : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 17.7 → "17,7" (one decimal, pt-BR). */
export const dec1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);
