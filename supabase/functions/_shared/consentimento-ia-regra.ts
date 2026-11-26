// VANT — AI consent rule, pure (no imports): shared by the edge functions and the app's tests.
// The disclosure version the vendor must have accepted. Bump it whenever the list of AI providers
// or of data sent changes (and the texts: src/features/consentimento-ia/components/texto-ia.tsx,
// src/pages/Privacidade.tsx); every vendor then has to allow again before anything is sent.
// Must match VERSAO_DIVULGACAO_IA in src/shared/lib/consentimento-ia.ts (a test checks it).
export const VERSAO_DIVULGACAO_IA = "2026-11-26";

/** Only an explicit "Permitir" given on the CURRENT disclosure releases data to an AI. No row,
 *  refusal, revocation, an older version or a malformed row → false. */
export function consentimentoValido(linha: unknown, versaoAtual: string = VERSAO_DIVULGACAO_IA): boolean {
  if (!linha || typeof linha !== "object") return false;
  const l = linha as { permitido?: unknown; versao?: unknown };
  return l.permitido === true && typeof l.versao === "string" && l.versao === versaoAtual;
}
