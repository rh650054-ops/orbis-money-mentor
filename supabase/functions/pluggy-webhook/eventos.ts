// Vant — Open Finance V2 · Module A · A-PR2: the provider's events, recorded (pure: tested in vitest).
//
// Contract ("Ordem dos eventos"): every event received is recorded with its identifier and its
// arrival time; the event changes no state by itself — it triggers a lookup of the Item's current
// state, and that lookup (or its failure) is recorded too.
//
// SHADOW ONLY. This file writes to public.of_eventos (created by A-PR1) and to nothing else.
// Nothing reads that table yet: no state, screen, sale, badge or ranking depends on it. What the
// webhook does with an event is exactly what it did before; a repeated event is still processed
// as before (here it is only noticed). A failure to record never stops or changes the webhook:
// every function below swallows its own errors and says so in the log.
//
// WHAT IS STORED IS CHOSEN FIELD BY FIELD. Nothing is copied whole: not the event, not the Item,
// not its per-product detail. Each kept field is read by name and must have the expected shape
// (a short code, an identifier, a date, a boolean, a count); anything else — free text, nested
// objects, fields added by the provider later, values of the wrong type — is left out.
//   * of the event: its type, its id, the Item, who triggered it, the error code, the connector
//     and its status, and HOW MANY transactions it lists (never which);
//   * of the consulted Item: status, execution status, error code, four dates, the connector id,
//     and per known product whether it is up to date, since when, and how many warnings;
//   * what the webhook did with the event (a short code).
// Never stored: clientId, clientUserId, account and transaction ids, links, error messages and
// parameters, the Item's webhookUrl (it holds the webhook secret), credentials, instructions.
//
// THE PROVIDER'S TIME (provedor_em) IS NOT WRITTEN. Pluggy's events carry no time of their own
// (its documented payloads and every payload seen in production on 12/11/2026 have none), and the
// Item's update time is not the time of the event. The column stays empty until the provider
// supplies one. The arrival time (chegou_em) is ours and is set by the database.
//
// Who it belongs to: the vendor of the connection, once known — those rows are erased with the
// account (foreign key, on delete cascade). An event whose vendor is not known keeps user_id
// null and EXPIRES: see VALIDADE_SEM_VENDEDOR_DIAS.

/** Events not tied to a vendor are deleted after this many days. Initial value, approved 12/11/2026.
 *  The deletion runs inside the webhook (at most once an hour per running instance), so it only
 *  happens when new events arrive: with no traffic, an expired row waits for the next event. */
export const VALIDADE_SEM_VENDEDOR_DIAS = 7;
const INTERVALO_DA_LIMPEZA_MS = 60 * 60 * 1000;

export type LinhaDoEvento = {
  provedor: "pluggy";
  evento_id: string | null;
  item_id: string | null;
  tipo: string | null;
  bruto: Record<string, unknown>;
};

export type FechamentoDoEvento = {
  user_id?: string;
  resultado: string;
  bruto: Record<string, unknown>;
};

export interface PortasDosEventos {
  /** the new row's id; "repetido" when this provider event id is already stored; null on failure */
  inserir(linha: LinhaDoEvento): Promise<number | "repetido" | null>;
  fechar(id: number, campos: FechamentoDoEvento): Promise<boolean>;
  /** deletes ONLY rows with no vendor that arrived before `antesDe`; returns how many */
  limparSemVendedor(antesDe: string): Promise<number>;
  registrar(nivel: "info" | "erro", texto: string, dados?: Record<string, unknown>): void;
}

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

// ---- the only shapes a stored value may have ------------------------------------------------
/** A provider code, as the provider writes them: capitals, digits and _ (UPDATED, USER_INPUT_TIMEOUT,
 *  SYNC...). Kept as it came even when we do not know it (A13); anything else is not kept at all. */
const codigo = (v: unknown): string | null =>
  typeof v === "string" && /^[A-Z0-9_]{1,80}$/.test(v) ? v : null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** An event or Item id: a UUID, nothing else. */
const uuid = (v: unknown): string | null => (typeof v === "string" && UUID.test(v) ? v.toLowerCase() : null);
/** A connector id: a small whole number (Pluggy sends it as a number or as digits). */
const numero = (v: unknown): string | null => {
  const t = typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? String(v) : v;
  return typeof t === "string" && /^[0-9]{1,12}$/.test(t) ? t : null;
};
/** An event name: word/word (item/updated, transactions/created...). */
const nomeDoEvento = (v: unknown): string | null =>
  typeof v === "string" && /^[a-z_]{1,40}\/[a-z_]{1,40}$/.test(v) ? v : null;
/** A date the provider wrote as a date; returned normalised, or nothing. */
const data = (v: unknown): string | null => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v) || v.length > 40) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const booleano = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** Pure: the fields of the event that are kept, one by one. Never throws, whatever arrives. */
export function eventoSelecionado(payload: unknown): Record<string, unknown> {
  const p = objeto(payload) ?? {};
  const ids = p.transactionIds;
  return {
    event: nomeDoEvento(p.event),
    eventId: uuid(p.eventId),
    itemId: uuid(p.itemId) ?? uuid(objeto(p.item)?.id),
    triggeredBy: codigo(p.triggeredBy),
    erro: codigo(objeto(p.error)?.code),
    connectorId: numero(p.connectorId),
    statusDoConector: codigo(objeto(p.data)?.status),
    transacoes: Array.isArray(ids) ? ids.length : null,
  };
}

/** Pure: the row as it is first stored. */
export function linhaDoEvento(payload: unknown): LinhaDoEvento {
  const evento = eventoSelecionado(payload);
  return {
    provedor: "pluggy",
    evento_id: evento.eventId as string | null,
    item_id: evento.itemId as string | null,
    tipo: evento.event as string | null,
    bruto: { evento },
  };
}

/** The products whose detail is kept. A product the provider adds later is not stored until listed here. */
export const PRODUTOS_DO_DETALHE = [
  "accounts", "creditCards", "transactions", "investments", "investmentsTransactions",
  "identity", "paymentData", "loans",
] as const;

/** Pure: per known product, is it up to date, since when, and how many warnings (never their text). */
export function detalheSelecionado(statusDetail: unknown): Record<string, unknown> | null {
  const d = objeto(statusDetail);
  if (!d) return null;
  const saida: Record<string, unknown> = {};
  for (const produto of PRODUTOS_DO_DETALHE) {
    const x = objeto(d[produto]);
    if (!x) continue;
    saida[produto] = {
      isUpdated: booleano(x.isUpdated),
      lastUpdatedAt: data(x.lastUpdatedAt),
      avisos: Array.isArray(x.warnings) ? x.warnings.length : 0,
    };
  }
  return saida;
}

/** Pure: the fields of the consulted Item that are kept, one by one. Never the Item. */
export function itemConsultado(item: unknown): Record<string, unknown> | null {
  const i = objeto(item);
  if (!i) return null;
  return {
    status: codigo(i.status),
    executionStatus: codigo(i.executionStatus),
    erro: codigo(objeto(i.error)?.code),
    statusDetail: detalheSelecionado(i.statusDetail),
    createdAt: data(i.createdAt),
    updatedAt: data(i.updatedAt),
    lastUpdatedAt: data(i.lastUpdatedAt),
    consentExpiresAt: data(i.consentExpiresAt),
    conector: numero(objeto(i.connector)?.id),
  };
}

/** Pure: what may go to the function log about an event. Technical only: no identifier at all. */
export function eventoParaOLog(linha: LinhaDoEvento): Record<string, unknown> {
  const e = objeto(linha.bruto.evento) ?? {};
  return {
    tipo: linha.tipo,
    com_id: linha.evento_id !== null,
    com_item: linha.item_id !== null,
    origem: e.triggeredBy ?? null,
    erro: e.erro ?? null,
    transacoes: e.transacoes ?? null,
  };
}

/** Pure: a short code for what the webhook answered. `dito` wins when the exit named itself. */
export function resultadoDe(resposta: Record<string, unknown> | null | undefined, dito?: string): string {
  if (dito) return dito;
  const r = resposta ?? {};
  if (typeof r.ignorado === "string") return "ignorado";
  if (typeof r.adiado === "string") return `adiado:${r.adiado}`;
  if (r.removida === true) return "conexao_removida";
  if (r.pausado === true) return "pausado";
  if (r.sem_extrato === true) return "sem_extrato";
  if (typeof r.gravadas === "number") return "lido";
  return "sem_tratamento";
}

/** What the handler learns along the way and hands over when it closes the record. */
export type NotaDoEvento = {
  /** the connection's vendor, once the connection is known */
  userId?: string | null;
  /** undefined = the Item was not consulted; null = the consultation brought no Item */
  item?: unknown;
  /** HTTP status Pluggy answered to the consultation (404 = the Item no longer exists there) */
  httpDaConsulta?: number;
};

/** Pure: how the consultation of the Item ended. A failure is recorded, never guessed around. */
export function consultaDoItem(nota: NotaDoEvento): "nao_feita" | "ok" | "item_nao_existe" | "falhou" {
  if (nota.item === undefined) return "nao_feita";
  if (objeto(nota.item)) return "ok";
  return nota.httpDaConsulta === 404 ? "item_nao_existe" : "falhou";
}

/** Pure: what is written when the webhook is done with the event. No provider time: see the top. */
export function fechamentoDoEvento(linha: LinhaDoEvento, nota: NotaDoEvento, resultado: string): FechamentoDoEvento {
  const dono = uuid(nota.userId);
  return {
    ...(dono ? { user_id: dono } : {}),
    resultado: /^[a-z_]{1,40}(:[a-z_]{1,40})?$/.test(resultado) ? resultado : "sem_tratamento",
    bruto: { ...linha.bruto, consulta: consultaDoItem(nota), consultado: itemConsultado(nota.item) },
  };
}

export type RegistroAberto = { id: number | null; linha: LinhaDoEvento };

/** Stores the event as soon as it is accepted. Never throws; a failure only loses the record. */
export async function abrirRegistro(p: PortasDosEventos, payload: unknown): Promise<RegistroAberto> {
  const linha = linhaDoEvento(payload);
  try {
    const r = await p.inserir(linha);
    if (r === "repetido") {
      p.registrar("info", "pluggy-webhook: evento repetido, ja registrado", { tipo: linha.tipo });
      return { id: null, linha };
    }
    if (r === null) p.registrar("erro", "pluggy-webhook: evento nao registrado", { tipo: linha.tipo });
    return { id: r, linha };
  } catch {
    p.registrar("erro", "pluggy-webhook: evento nao registrado", { tipo: linha.tipo });
    return { id: null, linha };
  }
}

/** Completes the record with the vendor, the consulted state and what was done. Never throws. */
export async function fecharRegistro(
  p: PortasDosEventos, aberto: RegistroAberto, nota: NotaDoEvento, resultado: string,
): Promise<void> {
  if (aberto.id === null) return;
  try {
    const ok = await p.fechar(aberto.id, fechamentoDoEvento(aberto.linha, nota, resultado));
    if (!ok) p.registrar("erro", "pluggy-webhook: registro do evento nao foi completado", { tipo: aberto.linha.tipo });
  } catch {
    p.registrar("erro", "pluggy-webhook: registro do evento nao foi completado", { tipo: aberto.linha.tipo });
  }
}

/** Pure: is it time to look for expired vendor-less events again? (at most once an hour) */
export function horaDeLimpar(agoraMs: number, ultimaMs: number): boolean {
  return ultimaMs <= 0 || agoraMs - ultimaMs >= INTERVALO_DA_LIMPEZA_MS;
}

/** Pure: events with no vendor that arrived before this instant are expired. */
export function corteSemVendedor(agora: Date): string {
  return new Date(agora.getTime() - VALIDADE_SEM_VENDEDOR_DIAS * 86_400_000).toISOString();
}

/** Deletes the expired vendor-less events. Never throws. */
export async function limparVencidos(p: PortasDosEventos, agora: Date): Promise<void> {
  try {
    const n = await p.limparSemVendedor(corteSemVendedor(agora));
    if (n > 0) p.registrar("info", "pluggy-webhook: eventos sem vendedor vencidos, apagados", { quantos: n });
  } catch {
    p.registrar("erro", "pluggy-webhook: limpeza dos eventos sem vendedor falhou");
  }
}
