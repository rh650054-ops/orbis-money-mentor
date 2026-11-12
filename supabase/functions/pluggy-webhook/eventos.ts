// Vant — Open Finance V2 · Module A · A-PR2: the provider's events, recorded (pure: tested in vitest).
//
// Contract ("Ordem dos eventos"): every event received is stored raw, with its identifier, the
// provider's time and the arrival time; the event changes no state by itself — it triggers a
// lookup of the Item's current state, and that lookup (or its failure) is recorded too.
//
// SHADOW ONLY. This file writes to public.of_eventos (created by A-PR1) and to nothing else.
// Nothing reads that table yet: no state, screen, sale, badge or ranking depends on it. What the
// webhook does with an event is exactly what it did before; a repeated event is still processed
// as before (here it is only noticed). A failure to record never stops or changes the webhook:
// every function below swallows its own errors and says so in the log.
//
// What is stored:
//   * the event as Pluggy sent it, minus `clientId` (our own application id at Pluggy: constant,
//     half of a credential pair, no use in a per-event log);
//   * a fixed list of fields of the Item as consulted (status, execution, error code, dates,
//     connector, per-product detail). Never the whole Item: it carries `webhookUrl`, which holds
//     the webhook secret, and `parameter`;
//   * what the webhook did with the event (a short code).
// Who it belongs to: the vendor of the connection, once known — those rows are erased with the
// account (foreign key, on delete cascade). An event whose vendor is not known keeps user_id
// null and EXPIRES: see VALIDADE_SEM_VENDEDOR_DIAS.

/** Events not tied to a vendor are deleted after this many days (the function logs keep the same
 *  payload for about as long today). */
export const VALIDADE_SEM_VENDEDOR_DIAS = 7;
/** A payload larger than this is not stored whole (Pluggy can list thousands of transaction ids). */
export const TAMANHO_MAXIMO_DO_EVENTO = 100_000;
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
  provedor_em?: string;
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

const texto = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Pure: the event as it is stored. Never throws, whatever arrives. */
export function linhaDoEvento(payload: unknown): LinhaDoEvento {
  const p = objeto(payload) ?? {};
  const { clientId: _nosso, ...semClientId } = p;
  const tipo = texto(p.event);
  const evento_id = texto(p.eventId);
  const item_id = texto(p.itemId) ?? texto(objeto(p.item)?.id);
  let evento: Record<string, unknown> = semClientId;
  let tamanho = 0;
  try { tamanho = JSON.stringify(semClientId).length; } catch { tamanho = TAMANHO_MAXIMO_DO_EVENTO + 1; }
  if (tamanho > TAMANHO_MAXIMO_DO_EVENTO) {
    evento = { event: tipo, eventId: evento_id, itemId: item_id, cortado: true, tamanho };
  }
  return { provedor: "pluggy", evento_id, item_id, tipo, bruto: { evento } };
}

/** Pure: the fields of the consulted Item that are kept. A fixed list — never the whole Item. */
export function itemConsultado(item: unknown): Record<string, unknown> | null {
  const i = objeto(item);
  if (!i) return null;
  const erro = objeto(i.error);
  const conector = objeto(i.connector);
  return {
    status: i.status ?? null,
    executionStatus: i.executionStatus ?? null,
    erro: erro ? (erro.code ?? null) : null,
    statusDetail: i.statusDetail ?? null,
    createdAt: i.createdAt ?? null,
    updatedAt: i.updatedAt ?? null,
    lastUpdatedAt: i.lastUpdatedAt ?? null,
    consentExpiresAt: i.consentExpiresAt ?? null,
    conector: conector ? { id: conector.id ?? null, name: conector.name ?? null } : null,
  };
}

/** Pure: the provider's own time for the state consulted, when it is a real date. */
export function horaDoProvedor(item: unknown): string | undefined {
  const i = objeto(item);
  for (const bruto of [i?.updatedAt, i?.lastUpdatedAt]) {
    if (typeof bruto !== "string" || bruto.trim() === "") continue;
    const d = new Date(bruto);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
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
  if (nota.item) return "ok";
  return nota.httpDaConsulta === 404 ? "item_nao_existe" : "falhou";
}

/** Pure: what is written when the webhook is done with the event. */
export function fechamentoDoEvento(linha: LinhaDoEvento, nota: NotaDoEvento, resultado: string): FechamentoDoEvento {
  const consulta = consultaDoItem(nota);
  const provedor_em = horaDoProvedor(nota.item);
  return {
    ...(texto(nota.userId) ? { user_id: texto(nota.userId) as string } : {}),
    ...(provedor_em ? { provedor_em } : {}),
    resultado,
    bruto: { ...linha.bruto, consulta, consultado: itemConsultado(nota.item) },
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
