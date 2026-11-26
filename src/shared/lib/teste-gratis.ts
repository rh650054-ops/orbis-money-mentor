/* The free test (Rick, 26/11/2026): fixed on every platform, no promotional exception —
   "the first day he signs up, the other 3 he sells" (day 0 + 3 selling days = 4 dates).
   Rule (the same as the server, profiles_protege_criacao / register-user): trial_end = the sign-up
   day in Brasília + 3, and access lasts until 23:59 of trial_end (check_trial_expired expires when
   trial_end < today in Brasília). Example: signed up on 26/11 → the test goes until 29/11 23:59. */
const hojeBR = (agora: Date) => agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** "29/11" for a sign-up now (dd/mm, Brasília). */
export function fimDoTeste3Dias(agora: Date = new Date()): string {
  const [a, m, d] = hojeBR(agora).split("-").map(Number) as [number, number, number];
  const fim = new Date(Date.UTC(a, m - 1, d + 3, 12));
  return `${String(fim.getUTCDate()).padStart(2, "0")}/${String(fim.getUTCMonth() + 1).padStart(2, "0")}`;
}
