/* The DEFCON marks "the day ended" here; the Home reads the mark ONCE, plays the end-of-day
   animation and clears it — so nobody watches it again by refreshing. Valid for 12h: closed at
   night, opened in the morning, still plays. (Replaces the old small-flame mark of 01/09.) */
import { avisar } from "@/shared/lib/avisar";

export const CHAVE_FIM_DO_DIA = (uid: string) => `orbis_chama_acender_${uid}`;
const VALIDADE_MS = 12 * 60 * 60 * 1000;

export function marcarFimDoDia(uid: string | undefined) {
  if (!uid) return;
  try { localStorage.setItem(CHAVE_FIM_DO_DIA(uid), String(Date.now())); } catch (e) { avisar.silencioso("constancia: marcar fim do dia", e); }
}

/** Is there a fresh mark? (does not clear it) */
export function fimDoDiaPendente(uid: string | undefined, agora = Date.now()): boolean {
  if (!uid) return false;
  try {
    const v = localStorage.getItem(CHAVE_FIM_DO_DIA(uid));
    if (!v) return false;
    if (v === "1") return true;
    return agora - Number(v) < VALIDADE_MS;
  } catch { return false; }
}

export function limparFimDoDia(uid: string | undefined) {
  if (!uid) return;
  try { localStorage.removeItem(CHAVE_FIM_DO_DIA(uid)); } catch (e) { avisar.silencioso("constancia: limpar fim do dia", e); }
}
