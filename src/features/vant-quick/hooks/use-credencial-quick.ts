import { useEffect } from "react";
import { quick } from "../api/ponte";
import { emitirCredencial, urlDoProjeto, useQuickDisponivel } from "../api/credencial";
import { credencialExpiraEm, idDoAparelho, marcarCredencial } from "../lib/memoria";

const RENOVAR_ANTES = 7 * 24 * 60 * 60_000;

/** Keeps this device able (or not) to register from the widget / Live Activity, as the SERVER says:
    - allowed: a device credential in the Keychain, renewed a week before it expires;
    - not allowed (switches off, account not switched on): the buttons are hidden natively. */
export function useCredencialQuick(conta: string | null) {
  const { data: interativo } = useQuickDisponivel(conta);
  useEffect(() => {
    if (!conta || interativo === undefined) return;
    let vivo = true;
    void (async () => {
      if (!interativo) { await quick.definirInterativo(false); return; }
      const expira = credencialExpiraEm(conta);
      if (!expira || expira - Date.now() < RENOVAR_ANTES) {
        try {
          const c = await emitirCredencial(idDoAparelho());
          if (!vivo) return;
          if (!(await quick.guardarCredencial(c.token, urlDoProjeto()))) return;   // no Keychain: stays off
          marcarCredencial(conta, c.expiraEm);
        } catch { return; }   // offline: next time; the buttons stay as they were
      }
      if (vivo) await quick.definirInterativo(true);
    })();
    return () => { vivo = false; };
  }, [conta, interativo]);
}
