/* The DEFCON marks "the day ended" here; the Home reads the mark ONCE, plays the end-of-day
   animation and clears it — so nobody watches it again by refreshing. Valid for 12h: closed at
   night, opened in the morning, still plays. (Replaces the old small-flame mark of 01/09.)
   06/11 (Rick: "toda hora que abro o app fica aparecendo a chama"): the mark is cleared the
   moment the screen OPENS (before, only on "Combinado!", so closing the app mid-animation
   replayed it on every open), and it plays at most once per day. */
import { avisar } from "@/shared/lib/avisar";

export const CHAVE_FIM_DO_DIA = (uid: string) => `orbis_chama_acender_${uid}`;
const CHAVE_MOSTRADO = (uid: string) => `orbis_chama_mostrada_${uid}`;
const VALIDADE_MS = 12 * 60 * 60 * 1000;
const diaLocal = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

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
    // the day the DEFCON closed already had its animation (two Focos in one day = one animation)
    if (localStorage.getItem(CHAVE_MOSTRADO(uid)) === diaLocal(Number(v))) return false;
    return agora - Number(v) < VALIDADE_MS;
  } catch { return false; }
}

/** Called when the screen opens: clears the mark and remembers which day already played. */
export function limparFimDoDia(uid: string | undefined) {
  if (!uid) return;
  try {
    const v = localStorage.getItem(CHAVE_FIM_DO_DIA(uid));
    localStorage.removeItem(CHAVE_FIM_DO_DIA(uid));
    if (v && v !== "1") localStorage.setItem(CHAVE_MOSTRADO(uid), diaLocal(Number(v)));
  } catch (e) { avisar.silencioso("constancia: limpar fim do dia", e); }
}
