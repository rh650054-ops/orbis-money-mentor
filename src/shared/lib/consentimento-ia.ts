/* Consent before personal data goes to a third-party AI (App Store 5.1.2(i) + LGPD, 23/11/2026).
 *
 * ONE gate for the whole app: the Supabase client's fetch calls bloqueioIa() before every
 * /functions/v1/<name> request. If <name> sends user data to Anthropic / OpenAI / Gemini and the
 * vendor has not said "Permitir", the request never leaves the phone: it answers 403
 * { error: "ia_sem_consentimento" } locally. User-started features also fire EVENTO_IA_DESLIGADA
 * so a sheet explains why; automatic ones (end of DEFCON, coach, weather tip) stay silent.
 *
 * The state is set by the consentimento-ia feature from its React Query data. */

/** Edge functions that send the vendor's data to a third-party AI. */
export const FUNCOES_IA: ReadonlySet<string> = new Set([
  "bright-action", "generate-insights", "objetivo-lucro-ia",
  "verificar-extrato", "extrato-analisar", "nota-ler", "estudio-arte", "verificar-deposito",
]);
/* 26/11: clima-vendedor and defcon-coach are NOT blocked here on purpose: the weather forecast and the
   DEFCON message must work without AI. Their servers check the permission themselves
   (supabase/functions/_shared/consentimento-ia.ts) and, without it, answer with the no-AI version
   (local weather opinion / plain template) — nothing is sent to an AI. Every other function above
   is ALSO refused on the server, so old app versions and direct calls are covered. */

/** Run without the vendor asking: blocked in silence (no sheet popping up mid-DEFCON). */
export const FUNCOES_IA_AUTOMATICAS: ReadonlySet<string> = new Set(["generate-insights"]);

/** Disclosure version the vendor must have accepted (26/11: per-feature list, adds Cerebras). An answer
 *  given on an older text counts as "not answered": the app asks again and the server refuses AI.
 *  Must match supabase/functions/_shared/consentimento-ia-regra.ts (a test checks it). */
export const VERSAO_DIVULGACAO_IA = "2026-11-26";

export const EVENTO_IA_DESLIGADA = "vant:ia-desligada";
export const ERRO_IA_SEM_CONSENTIMENTO = "ia_sem_consentimento";

let permitido = false;
export const definirConsentimentoIa = (v: boolean): void => { permitido = v; };
export const iaPermitida = (): boolean => permitido;

/** "/functions/v1/nota-ler?x=1" → "nota-ler"; anything else → null. */
export function nomeDaFuncao(url: string): string | null {
  const m = /\/functions\/v1\/([^/?#]+)/.exec(url);
  return m?.[1] ?? null;
}

/** Called by the Supabase fetch. null = let it through; a Response = blocked here. */
export function bloqueioIa(url: string): Response | null {
  const nome = nomeDaFuncao(url);
  if (!nome || !FUNCOES_IA.has(nome) || permitido) return null;
  if (!FUNCOES_IA_AUTOMATICAS.has(nome)) {
    try { window.dispatchEvent(new CustomEvent(EVENTO_IA_DESLIGADA, { detail: nome })); } catch { /* old browser */ }
  }
  return new Response(JSON.stringify({ error: ERRO_IA_SEM_CONSENTIMENTO }), {
    status: 403, headers: { "Content-Type": "application/json" },
  });
}
