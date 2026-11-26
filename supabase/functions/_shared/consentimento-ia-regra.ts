// VANT — AI consent rule, pure (no imports): shared by the edge functions and the app's tests.
// The disclosure version new answers are recorded on. Bump it whenever the list of AI providers
// or of data sent changes (and the texts: src/features/consentimento-ia/components/texto-ia.tsx,
// src/pages/Privacidade.tsx). Must match VERSAO_DIVULGACAO_IA in src/shared/lib/consentimento-ia.ts
// (a test checks it). The value is an identifier in date format (the RPC only accepts that shape)
// and must grow at each change; it is not the day the text went live.
// 2026-11-27: the profit mission and the DEFCON message also name Anthropic.
// 2026-11-28: two providers only (Rick, 26/11): Anthropic first, OpenAI for voice, images and as
//   the reserve. Google (Gemini) and Cerebras left every row; "Importar histórico" was added.
export const VERSAO_DIVULGACAO_IA = "2026-11-28";

/** Older texts whose "Permitir" still counts, so nobody is asked again without need: everything
 *  the vendor allowed on them is still what happens, or less. 2026-11-27 named Anthropic on every
 *  text row and OpenAI for the Mentor's voice and the Estúdio's images; 2026-11-28 only REMOVED
 *  recipients from those rows. What is NEW on 2026-11-28 (OpenAI as the reserve for text and
 *  document reading, and "Importar histórico") needs an answer on the current text: see
 *  consentimentoNoTextoAtual. Texts older than 2026-11-27 are not here: the profit mission and
 *  the DEFCON message did not name Anthropic on them. */
export const VERSOES_QUE_AINDA_VALEM: readonly string[] = ["2026-11-27"];

type Linha = { permitido?: unknown; versao?: unknown };
const versaoDe = (linha: unknown): string | null => {
  if (!linha || typeof linha !== "object") return null;
  const l = linha as Linha;
  return l.permitido === true && typeof l.versao === "string" ? l.versao : null;
};

/** An explicit "Permitir" on the CURRENT disclosure: releases everything the current text names. */
export function consentimentoNoTextoAtual(linha: unknown, versaoAtual: string = VERSAO_DIVULGACAO_IA): boolean {
  return versaoDe(linha) === versaoAtual;
}

/** An explicit "Permitir" on the current disclosure or on an older one that still counts. No row,
 *  refusal, revocation, any other version or a malformed row → false. */
export function consentimentoValido(
  linha: unknown, versaoAtual: string = VERSAO_DIVULGACAO_IA, aindaValem: readonly string[] = VERSOES_QUE_AINDA_VALEM,
): boolean {
  const v = versaoDe(linha);
  return v !== null && (v === versaoAtual || aindaValem.includes(v));
}
