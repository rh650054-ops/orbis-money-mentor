/* Pure helpers for the Pro showcase on the Vender tab. */
import type { DiaConc } from "../types";

/** What the vendor typed in the 3 days ending `hoje` (YYYY-MM-DD, Brazil). */
export function lancadoUltimos3Dias(dias: DiaConc[], hoje: string): number {
  const [y, m, d] = hoje.split("-").map(Number);
  const inicio = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  inicio.setUTCDate(inicio.getUTCDate() - 2);
  const desde = inicio.toISOString().slice(0, 10);
  return dias.filter((x) => x.dia >= desde && x.dia <= hoje).reduce((s, x) => s + (x.fez || 0), 0);
}

/** Whole days left in the trial (0 = ends today), or null when not on trial. */
export function diasRestantesDeTeste(status: string | null, fimDoTeste: string | null, hoje: string): number | null {
  if (status !== "trial" || !fimDoTeste) return null;
  const dias = Math.round((Date.parse(`${fimDoTeste.slice(0, 10)}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000);
  return Number.isFinite(dias) ? Math.max(0, dias) : null;
}

/** Pays the Essencial already (not trial/demo): sees the upgrade only. */
export const assinaEssencial = (s: { subscribed: boolean; status: string | null }): boolean =>
  s.subscribed && !["trial", "demo"].includes(String(s.status));
