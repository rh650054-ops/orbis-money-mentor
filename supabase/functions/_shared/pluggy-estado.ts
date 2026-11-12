// A3 (12/11/2026) — connection, consent and reconnection states, in ONE place.
//
// The app, the robot (pluggy-hora / pluggy-sync), the webhook and pluggy-item all have to answer
// the same questions about a bank: is it fine, is it being read, is the bank late, or is it
// waiting for the SELLER? Until now the app and the robot each kept their own list, and only
// Pluggy's general `status` was stored. Pluggy says "OUTDATED" both when the bank is down and when
// the seller never finished the authorisation (executionStatus USER_INPUT_TIMEOUT). Stored as
// OUTDATED, the app said "o banco está fora — não é você", offered no "Autorizar", and the robot
// asked Pluggy to refresh again — which re-opened the consent and timed out again
// (17/10: 32 of these in a day, 0 data; 12/11 09:00: one more).
//
// Rules (Module A contract, sections 4 and 6):
//   - what is stored is always something PLUGGY said: its status, or — when its reason for the
//     failure is one that depends on the seller — that reason;
//   - "UPDATED" is never replaced, and never proves the consent is valid (A12);
//   - a value we do not know is "desconhecido": kept as it came and never shown as success (A13);
//   - a bank that is down is late data, not a consent state;
//   - every state that depends on the seller leads to reauthorising the SAME Item (A8);
//   - A5: whoever reads the bank checks the state against what Pluggy says at that moment.
//
// Pluggy's values come from its documentation (item lifecycle; errors & validations, Open Finance
// subset; webhooks). No Deno and no imports here: the app uses this same file.

export type ItemDoEstado = {
  status?: string | null;
  executionStatus?: string | null;
  error?: { code?: string | null } | null;
  consentExpiresAt?: string | null;
};

/** What a stored status means for the app and the robot. */
export type Grupo = "em_dia" | "lendo" | "precisa_vendedor" | "provedor_atrasado" | "removido" | "desconhecido";

/** Consent states of the Module A contract (section 4). */
export type Consentimento =
  | "autorizado" | "expirando" | "aguardando_vendedor" | "credencial_invalida"
  | "expirado" | "revogado" | "nao_informado" | "desconhecido";

export type Acao = "nenhuma" | "reautorizar";

/** Days before consentExpiresAt from which the consent counts as "expirando". */
export const DIAS_EXPIRANDO = 7;

const cod = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase() : "");

/** Reasons (status or executionStatus) that only the seller can solve, and the consent they mean. */
const DO_VENDEDOR: Readonly<Record<string, Consentimento>> = {
  WAITING_USER_INPUT: "aguardando_vendedor", // MFA / approval expected
  WAITING_USER_ACTION: "aguardando_vendedor", // approve in the bank's app, scan a QR code
  USER_INPUT_TIMEOUT: "aguardando_vendedor", // never finished the authorisation
  USER_AUTHORIZATION_PENDING: "aguardando_vendedor",
  USER_AUTHORIZATION_NOT_GRANTED: "aguardando_vendedor", // rejected the consent in the flow
  USER_AUTHORIZATION_REVOKED: "revogado", // revoked the consent at the bank
  INVALID_CREDENTIALS: "credencial_invalida",
  INVALID_CREDENTIALS_MFA: "credencial_invalida",
  LOGIN_ERROR: "credencial_invalida", // Pluggy's status for "must provide credentials again"
};

const LENDO = new Set(["UPDATING", "LOGIN_IN_PROGRESS"]);
/** The provider or the bank failed; nothing for the seller to do. */
const ATRASADO = new Set(["OUTDATED", "ERROR", "SITE_NOT_AVAILABLE", "CONNECTION_ERROR"]);

/** Every value this file knows, for tests that keep the app and the robot in step. */
export const STATUS_CONHECIDOS: readonly string[] = [
  "UPDATED", ...LENDO, ...Object.keys(DO_VENDEDOR), ...ATRASADO, "deleted",
];

/** Reads a STORED status (bank_connections.status). */
export function grupoDoStatus(status: string | null | undefined): Grupo {
  const s = cod(status);
  if (s === "UPDATED") return "em_dia";
  if (LENDO.has(s)) return "lendo";
  if (s in DO_VENDEDOR) return "precisa_vendedor";
  if (ATRASADO.has(s)) return "provedor_atrasado";
  if (s === "DELETED") return "removido";
  return "desconhecido";
}

/** The bank is waiting for the SELLER (consent not finished, revoked, credentials changed).
 *  Asking Pluggy to refresh it only re-opens the consent and expires again
 *  (André 09/10: 4 USER_INPUT_TIMEOUT overnight, 0 transactions). Don't read it
 *  until the seller authorises again in the app. */
export function precisaDoVendedor(status: string | null | undefined): boolean {
  return grupoDoStatus(status) === "precisa_vendedor";
}

/** Pluggy's reason for the last execution: executionStatus, or the error code. */
function motivoDoItem(item: ItemDoEstado): string {
  return cod(item.executionStatus) || cod(item.error?.code);
}

/** What to store in bank_connections.status for this Item. "" = Pluggy sent no status at all
 *  (the caller keeps what it had). Always a value Pluggy sent. */
export function statusParaGravar(item: ItemDoEstado | null | undefined): string {
  if (!item) return "";
  const bruto = typeof item.status === "string" ? item.status.trim() : "";
  const s = bruto.toUpperCase();
  if (!s || s === "UPDATED") return bruto;
  const motivo = motivoDoItem(item);
  if (motivo in DO_VENDEDOR) return motivo; // the reason says more than "OUTDATED" / "UPDATING"
  return bruto;
}

/** A5 — periodic check (contract section 4, event order 4 and 5). A reader that has just asked
 *  Pluggy for the Item uses the answer for the state too, so a lost or late event cannot leave the
 *  connection wrong until the next one:
 *   - `gravar`: the status to store now, or null to leave it as it is;
 *   - `podePedir`: whether Pluggy may be asked to refresh this bank — never while what Pluggy
 *     says NOW depends on the seller, whatever is stored.
 *  `item` null = Pluggy did not answer: the stored state does not change (and decides alone). */
export function conferirEstado(
  gravado: string | null | undefined, item: ItemDoEstado | null | undefined,
): { gravar: string | null; podePedir: boolean; conferido: boolean } {
  const atual = typeof gravado === "string" ? gravado : "";
  // a removed connection is never brought back by a check, whatever Pluggy still says
  if (grupoDoStatus(atual) === "removido") return { gravar: null, podePedir: false, conferido: false };
  const novo = statusParaGravar(item);
  if (!novo) return { gravar: null, podePedir: !precisaDoVendedor(atual), conferido: false };
  return { gravar: novo !== atual ? novo : null, podePedir: !precisaDoVendedor(novo), conferido: true };
}

const dataValida = (v: unknown): number => {
  const t = typeof v === "string" && v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : NaN;
};

/** The consent, from what Pluggy says explicitly. Never deduced from "UPDATED" or from data. */
export function consentimentoDoItem(item: ItemDoEstado | null | undefined, agora: Date = new Date()): Consentimento {
  if (!item) return "nao_informado";
  const s = cod(item.status);
  if (s !== "UPDATED") {
    const motivo = motivoDoItem(item);
    if (motivo in DO_VENDEDOR) return DO_VENDEDOR[motivo] ?? "desconhecido";
    if (s in DO_VENDEDOR) return DO_VENDEDOR[s] ?? "desconhecido";
  }
  const vence = dataValida(item.consentExpiresAt);
  if (Number.isFinite(vence)) {
    if (vence <= agora.getTime()) return "expirado";
    if (vence - agora.getTime() <= DIAS_EXPIRANDO * 86_400_000) return "expirando";
    return "autorizado";
  }
  return grupoDoStatus(s) === "desconhecido" ? "desconhecido" : "nao_informado";
}

/** Every consent state that depends on the seller is solved the same way: reauthorise the same Item. */
export function acaoDoVendedor(c: Consentimento): Acao {
  return c === "aguardando_vendedor" || c === "credencial_invalida" || c === "expirado" || c === "revogado"
    ? "reautorizar" : "nenhuma";
}

/** What Pluggy said and what we make of it, for the log. No personal data. */
export function resumoDoEstado(item: ItemDoEstado | null | undefined, agora: Date = new Date()) {
  const consentimento = consentimentoDoItem(item, agora);
  return {
    status: item?.status ?? null,
    exec: item?.executionStatus ?? null,
    erro: item?.error?.code ?? null,
    expira: item?.consentExpiresAt ?? null,
    gravar: statusParaGravar(item) || null,
    consentimento,
    acao: acaoDoVendedor(consentimento),
  };
}
