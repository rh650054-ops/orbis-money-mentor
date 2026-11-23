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
  "bright-action", "generate-insights", "defcon-coach", "clima-vendedor", "objetivo-lucro-ia",
  "verificar-extrato", "extrato-analisar", "nota-ler", "estudio-arte", "verificar-deposito",
]);

/** Run without the vendor asking: blocked in silence (no sheet popping up mid-DEFCON). */
export const FUNCOES_IA_AUTOMATICAS: ReadonlySet<string> = new Set([
  "generate-insights", "defcon-coach", "clima-vendedor",
]);

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
