import { useEspelhoQuick, type DefconParaEspelho } from "./use-espelho-quick";
import { useProcessarQuick, type DefconParaQuick } from "./use-processar-quick";

/** Called by the real DEFCON page right after useDefconChallenge, with THAT same instance (a second
    instance would hold other totals and overwrite them). conta null (practice run) = off.
    Runs the widget taps through the DEFCON's own code and mirrors the session to the widget and the
    Live Activity. */
export function useVantQuickDefcon(conta: string | null, defcon: DefconParaQuick & DefconParaEspelho) {
  useProcessarQuick(conta, defcon);
  useEspelhoQuick(conta, defcon);
}
