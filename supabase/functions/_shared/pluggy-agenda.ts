// Vant — WHEN the server may read a vendor's bank (Pluggy). 08/10/2026.
//
// Rick's rule (07/10): only read the bank when it matters. With 4 vendors on
// Open Finance the old robot (every 5 min, 8h→24h, for everyone) was cheap;
// with 500+ it would be ~96k reads/day and a bill/peak we can't afford.
//
// The agenda, in Brasília time:
//   • manhã       — 1 read in the morning (08:00 + a per-vendor offset up to 2h)
//   • foco        — while Modo Foco (DEFCON) is on: 1 read per hour
//   • pós-foco    — when the Foco ends: the app reads right away (pluggy-sync);
//                   the server makes sure of it and reads once more ~1h later
//   • fechamento  — 1 read after midnight to close the day (00:05 + offset up to 3h)
//   • nothing else: a vendor who is not selling costs zero reads.
//
// TRAVAS (hard limits, never crossed):
//   • LIMITE_DIA reads per bank per day (counter on bank_connections)
//   • LIMITE_GLOBAL_DIA reads per day for the whole app — past it, only the
//     closing read runs (the day still closes for everyone)
//   • MAX_POR_RODADA banks per robot run (every 5 min) — spreads peaks
//   • a manual "puxar agora" from the app waits MIN_ENTRE_LEITURAS since the last read
//
// Pure functions only (no Deno APIs): the same file is unit-tested by vitest.

export type Motivo = "fechamento" | "foco" | "pos_foco" | "manha";

export const LIMITE_DIA = 18;
export const LIMITE_GLOBAL_DIA = 6000;
export const MAX_POR_RODADA = 25;
export const MIN_ENTRE_LEITURAS_MIN = 10;
/** Pluggy accepts 1 refresh request (PATCH) per hour per item. */
export const PEDIDO_MIN_MS = 61 * 60_000;

const BRT_OFFSET_MIN = -3 * 60; // Brasília has no DST since 2019

/** Priority when the run has more due banks than MAX_POR_RODADA. */
export const PRIORIDADE: Record<Motivo, number> = { fechamento: 0, foco: 1, pos_foco: 2, manha: 3 };

export interface Contexto {
  agora: Date;
  userId: string;
  /** last time the server read this bank (bank_connections.last_synced_at) */
  ultimaLeitura: Date | null;
  /** Modo Foco running right now (session active and alive) */
  focoAtivo: boolean;
  /** when today's last Foco ended (null if none ended today) */
  focoFimEm: Date | null;
  /** reads already made today for this bank */
  leiturasHoje: number;
  /** reads made today by the whole app */
  leiturasGlobaisHoje: number;
}

/** Stable 0..span-1 offset per vendor: spreads everyone over the window. */
export function deslocamento(userId: string, span: number): number {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % span;
}

/** Minutes since 00:00 in Brasília, and the instant that day started. */
export function relogioBRT(agora: Date): { minutoDoDia: number; inicioDoDia: Date; dia: string } {
  const local = new Date(agora.getTime() + BRT_OFFSET_MIN * 60_000);
  const minutoDoDia = local.getUTCHours() * 60 + local.getUTCMinutes();
  const dia = local.toISOString().slice(0, 10);
  const inicioDoDia = new Date(Date.parse(`${dia}T00:00:00Z`) - BRT_OFFSET_MIN * 60_000);
  return { minutoDoDia, inicioDoDia, dia };
}

const minutosEntre = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 60_000;

/** Why this bank should be read now — or null (most of the time). */
export function motivoDeLeitura(c: Contexto): Motivo | null {
  if (c.leiturasHoje >= LIMITE_DIA) return null;

  const { minutoDoDia, inicioDoDia } = relogioBRT(c.agora);
  const ultima = c.ultimaLeitura;
  const desdeUltima = ultima ? minutosEntre(c.agora, ultima) : Infinity;
  if (desdeUltima < MIN_ENTRE_LEITURAS_MIN) return null;

  // fechamento: once after midnight (00:05 + up to 3h), if nothing was read today yet
  const abreFechamento = 5 + deslocamento(c.userId, 175);
  const leuHoje = !!ultima && ultima.getTime() >= inicioDoDia.getTime();
  if (minutoDoDia >= abreFechamento && minutoDoDia < 4 * 60 && !leuHoje) return "fechamento";

  // past the global budget only the closing read runs
  if (c.leiturasGlobaisHoje >= LIMITE_GLOBAL_DIA) return null;

  // foco: 1 per hour while the Foco is on (the first one right when it starts)
  if (c.focoAtivo) return desdeUltima >= 60 ? "foco" : null;

  // pós-foco: right after it ends (if the app's own read didn't happen) and once more ~1h later
  if (c.focoFimEm) {
    const desdeFim = minutosEntre(c.agora, c.focoFimEm);
    const leuDepoisDoFim = !!ultima && ultima.getTime() >= c.focoFimEm.getTime();
    if (desdeFim >= 5 && desdeFim < 50 && !leuDepoisDoFim) return "pos_foco";
    const leuNaSegunda = !!ultima && minutosEntre(ultima, c.focoFimEm) >= 50;
    if (desdeFim >= 60 && desdeFim < 180 && !leuNaSegunda) return "pos_foco";
  }

  // manhã: once between 08:00 + offset and 12:00, if nothing was read since 06:00
  const abreManha = 8 * 60 + deslocamento(c.userId, 120);
  const seisDaManha = new Date(inicioDoDia.getTime() + 6 * 60 * 60_000);
  const leuDesdeSeis = !!ultima && ultima.getTime() >= seisDaManha.getTime();
  if (minutoDoDia >= abreManha && minutoDoDia < 12 * 60 && !leuDesdeSeis) return "manha";

  return null;
}

/** Counter for today's reads of one bank, given what is stored. */
export function contarLeitura(diaGuardado: string | null, qtdGuardada: number | null, hoje: string): number {
  return diaGuardado === hoje ? (qtdGuardada ?? 0) + 1 : 1;
}

/** Reads already made today (0 if the stored counter is from another day). */
export function leiturasDeHoje(diaGuardado: string | null, qtdGuardada: number | null, hoje: string): number {
  return diaGuardado === hoje ? (qtdGuardada ?? 0) : 0;
}

/** Can the app's "puxar agora" (end of Foco / day closing) read the bank now? */
export function podePuxarAgora(ultimaLeitura: Date | null, leiturasHoje: number, agora: Date): boolean {
  if (leiturasHoje >= LIMITE_DIA) return false;
  if (!ultimaLeitura) return true;
  return minutosEntre(agora, ultimaLeitura) >= MIN_ENTRE_LEITURAS_MIN;
}
