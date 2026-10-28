/* Welcome tour of the store app (Rick, 28/10/2026): everyone who opens the installed app for
   the first time sees it — with or without an account. Per install: the flag lives in the app's
   own storage, so reinstalling shows it again. Web/PWA keeps its own flow (/onboarding-novo). */
import { ehAppDaLoja } from "@/shared/lib/platform";

const CHAVE = "vant_boas_vindas_v1";

export function jaViuBoasVindas(): boolean {
  try { return localStorage.getItem(CHAVE) === "1"; } catch { return true; }
}

export function marcarBoasVindasVista(): void {
  try { localStorage.setItem(CHAVE, "1"); } catch { /* storage blocked: shows again next time */ }
}

/** Only the Play Store / App Store binary, only once per install. */
export function deveMostrarBoasVindas(nativo: boolean = ehAppDaLoja()): boolean {
  return nativo && !jaViuBoasVindas();
}
