// Vant — WHEN the server may read a vendor's bank (Pluggy). 08/10/2026.
//
// Two different things happen on a "read":
//   • import: we copy what Pluggy ALREADY has (free — no bank call);
//   • pedido: we ask Pluggy to fetch fresh data FROM THE BANK (PATCH /items).
// Only the pedido costs. Open Finance Brasil caps each CPF + bank at 240 fresh
// transaction pulls PER MONTH (docs.pluggy.ai/docs/rate-limits-of). Past that
// the bank stops sending new transactions until next month — the Pix, the
// ranking AND the Raio-X freeze. So every pedido comes out of a monthly budget.
//
// MONTHLY BUDGET (ORCAMENTO_MES per bank, 30 left for Pluggy's own auto-sync):
//   today's allowance = what is left this month ÷ days left (today included).
//   A day without Foco leaves budget behind, so the next Foco days get more.
//
// The agenda, in Brasília time:
//   • fechamento — 1 read after midnight to close the day (00:05 + offset up to 3h)
//   • foco       — while Modo Foco (DEFCON) is on: today's allowance, minus the
//                  2 after-Foco reads, spread over a typical Foco (4h). Never
//                  closer than PEDIDO_MIN (Pluggy's API cap, 1/h until support
//                  lifts it) nor FOCO_MIN_INTERVALO_MIN.
//   • pós-foco   — when the Foco ends: the app reads right away (pluggy-sync);
//                  the server makes sure of it and reads once more ~1h later
//   • manhã      — 1 read in the morning, ONLY if the month has budget to spare
//   • nothing else: a vendor who is not selling costs zero pedidos.
//
// TRAVAS (hard limits, never crossed):
//   • ORCAMENTO_MES pedidos per bank per month (counters on bank_connections)
//   • LIMITE_DIA reads per bank per day
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

/** Open Finance: 240 fresh pulls/month per CPF + bank. 30 kept for Pluggy's auto-sync. */
export const LIMITE_OPEN_FINANCE_MES = 240;
export const ORCAMENTO_MES = 210;
/** Reads kept aside for the end of every Foco (right after + ~1h later). */
export const RESERVA_POS_FOCO = 2;
/** A typical Foco, used to spread today's allowance over it. */
export const FOCO_TIPICO_MIN = 240;
/** Even with plenty of budget, Foco pedidos are never closer than this. */
export const FOCO_MIN_INTERVALO_MIN = 15;
/** Morning read only when the day still has at least this many pedidos to spare. */
export const MANHA_SE_SOBRAR = 6;
/** Pluggy accepts 1 refresh (PATCH) per hour per item on new accounts (docs: updating-an-item). */
export const PEDIDO_MIN_PADRAO_MIN = 61;

const BRT_OFFSET_MIN = -3 * 60; // Brasília has no DST since 2019

/** Priority when the run has more due banks than MAX_POR_RODADA. */
export const PRIORIDADE: Record<Motivo, number> = { fechamento: 0, foco: 1, pos_foco: 2, manha: 3 };

export interface Contexto {
  agora: Date;
  userId: string;
  /** last time the server read this bank (bank_connections.last_synced_at) */
  ultimaLeitura: Date | null;
  /** last fresh pull asked to the bank (bank_connections.pluggy_pedido_em) */
  ultimoPedido?: Date | null;
  /** Modo Foco running right now (session active and alive) */
  focoAtivo: boolean;
  /** when today's last Foco ended (null if none ended today) */
  focoFimEm: Date | null;
  /** reads already made today for this bank */
  leiturasHoje: number;
  /** reads made today by the whole app */
  leiturasGlobaisHoje: number;
  /** fresh pulls this bank may still make today (cotaDeHoje); undefined = no budget info */
  disponivelHoje?: number;
  /** minimum minutes between two pulls (Pluggy's cap) */
  pedidoMinMin?: number;
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
export function relogioBRT(agora: Date): { minutoDoDia: number; inicioDoDia: Date; dia: string; mes: string } {
  const local = new Date(agora.getTime() + BRT_OFFSET_MIN * 60_000);
  const minutoDoDia = local.getUTCHours() * 60 + local.getUTCMinutes();
  const dia = local.toISOString().slice(0, 10);
  const inicioDoDia = new Date(Date.parse(`${dia}T00:00:00Z`) - BRT_OFFSET_MIN * 60_000);
  return { minutoDoDia, inicioDoDia, dia, mes: dia.slice(0, 7) };
}

/** Days left in the Brasília month, today included (1 on the last day). */
export function diasRestantesNoMes(agora: Date): number {
  const { dia } = relogioBRT(agora);
  const [a, m, d] = dia.split("-").map(Number) as [number, number, number];
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return ultimo - d + 1;
}

/**
 * Fresh pulls this bank may still make today.
 * allowance(today) = (ORCAMENTO_MES − pulls before today) ÷ days left, minus pulls already made today.
 */
export function cotaDeHoje(pedidosMes: number, pedidosHoje: number, agora: Date, orcamento = ORCAMENTO_MES): number {
  const antesDeHoje = Math.max(0, pedidosMes - pedidosHoje);
  const restante = Math.max(0, orcamento - antesDeHoje);
  const doDia = Math.floor(restante / diasRestantesNoMes(agora));
  return Math.max(0, doDia - pedidosHoje);
}

/** Minutes between two Foco pulls, given what is left for today. Infinity = no Foco pulls left. */
export function intervaloFocoMin(disponivelHoje: number, pedidoMinMin = PEDIDO_MIN_PADRAO_MIN): number {
  const paraFoco = disponivelHoje - RESERVA_POS_FOCO;
  if (paraFoco <= 0) return Infinity;
  return Math.max(pedidoMinMin, FOCO_MIN_INTERVALO_MIN, Math.ceil(FOCO_TIPICO_MIN / paraFoco));
}

/** May this read also ask the bank for fresh data? */
export function podePedir(ultimoPedido: Date | null, disponivelHoje: number, agora: Date, pedidoMinMin = PEDIDO_MIN_PADRAO_MIN): boolean {
  if (disponivelHoje <= 0) return false;
  if (!ultimoPedido) return true;
  return minutosEntre(agora, ultimoPedido) >= pedidoMinMin;
}

const minutosEntre = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 60_000;

/** Why this bank should be read now — or null (most of the time). */
export function motivoDeLeitura(c: Contexto): Motivo | null {
  if (c.leiturasHoje >= LIMITE_DIA) return null;

  const { minutoDoDia, inicioDoDia } = relogioBRT(c.agora);
  const ultima = c.ultimaLeitura;
  const desdeUltima = ultima ? minutosEntre(c.agora, ultima) : Infinity;
  if (desdeUltima < MIN_ENTRE_LEITURAS_MIN) return null;
  const disponivel = c.disponivelHoje ?? Infinity;
  const pedidoMin = c.pedidoMinMin ?? PEDIDO_MIN_PADRAO_MIN;

  // fechamento: once after midnight (00:05 + up to 3h), if nothing was read today yet.
  // Always runs: even without budget it imports what Pluggy already has.
  const abreFechamento = 5 + deslocamento(c.userId, 175);
  const leuHoje = !!ultima && ultima.getTime() >= inicioDoDia.getTime();
  if (minutoDoDia >= abreFechamento && minutoDoDia < 4 * 60 && !leuHoje) return "fechamento";

  // past the global budget only the closing read runs
  if (c.leiturasGlobaisHoje >= LIMITE_GLOBAL_DIA) return null;

  // foco: today's allowance spread over the Foco (a read here only makes sense with a fresh pull)
  if (c.focoAtivo) {
    const intervalo = intervaloFocoMin(disponivel, pedidoMin);
    if (!Number.isFinite(intervalo)) return null;
    const desdePedido = c.ultimoPedido ? minutosEntre(c.agora, c.ultimoPedido) : Infinity;
    return desdePedido >= intervalo && desdeUltima >= intervalo ? "foco" : null;
  }

  // pós-foco: right after it ends (if the app's own read didn't happen) and once more ~1h later
  if (c.focoFimEm) {
    const desdeFim = minutosEntre(c.agora, c.focoFimEm);
    const leuDepoisDoFim = !!ultima && ultima.getTime() >= c.focoFimEm.getTime();
    if (desdeFim >= 5 && desdeFim < 50 && !leuDepoisDoFim) return "pos_foco";
    const leuNaSegunda = !!ultima && minutosEntre(ultima, c.focoFimEm) >= 50;
    if (desdeFim >= 60 && desdeFim < 180 && !leuNaSegunda) return "pos_foco";
  }

  // manhã: once between 08:00 + offset and 12:00, if nothing was read since 06:00 — and only
  // when the month has budget to spare (a Foco day needs it more)
  if (disponivel < MANHA_SE_SOBRAR) return null;
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

/** Fresh pulls stored for a period ('YYYY-MM' or 'YYYY-MM-DD'): 0 if the period changed. */
export function pedidosDoPeriodo(guardado: string | null, qtd: number | null, atual: string): number {
  return guardado === atual ? (qtd ?? 0) : 0;
}

/** Budget state of one bank right now. */
export function orcamentoDaConexao(
  c: { pedidos_mes?: string | null; pedidos_mes_qtd?: number | null; pedidos_dia?: string | null; pedidos_dia_qtd?: number | null },
  agora: Date,
): { mes: string; dia: string; pedidosMes: number; pedidosHoje: number; disponivelHoje: number } {
  const { mes, dia } = relogioBRT(agora);
  const pedidosMes = pedidosDoPeriodo(c.pedidos_mes ?? null, c.pedidos_mes_qtd ?? null, mes);
  const pedidosHoje = pedidosDoPeriodo(c.pedidos_dia ?? null, c.pedidos_dia_qtd ?? null, dia);
  return { mes, dia, pedidosMes, pedidosHoje, disponivelHoje: cotaDeHoje(pedidosMes, pedidosHoje, agora) };
}

/** Columns to store after one more fresh pull. */
export function contarPedido(o: { mes: string; dia: string; pedidosMes: number; pedidosHoje: number }) {
  return { pedidos_mes: o.mes, pedidos_mes_qtd: o.pedidosMes + 1, pedidos_dia: o.dia, pedidos_dia_qtd: o.pedidosHoje + 1 };
}

/**
 * How many days back to import, so a gap never loses entries: from the day before
 * the last read up to today. Open Finance "recent transactions" cover 1–6 days.
 */
export function diasParaImportar(ultimaLeitura: Date | null, agora: Date, minimo = 1): number {
  if (!ultimaLeitura) return Math.max(minimo, 6);
  const dias = Math.ceil((agora.getTime() - ultimaLeitura.getTime()) / 86_400_000) + 1;
  return Math.min(6, Math.max(minimo, dias));
}

/** Can the app's "puxar agora" (end of Foco / day closing) read the bank now? */
export function podePuxarAgora(ultimaLeitura: Date | null, leiturasHoje: number, agora: Date): boolean {
  if (leiturasHoje >= LIMITE_DIA) return false;
  if (!ultimaLeitura) return true;
  return minutosEntre(agora, ultimaLeitura) >= MIN_ENTRE_LEITURAS_MIN;
}
