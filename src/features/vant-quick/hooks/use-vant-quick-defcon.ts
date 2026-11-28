import { useEspelhoQuick, type DefconParaEspelho } from "./use-espelho-quick";

/** Called by the real DEFCON page right after useDefconChallenge, with THAT same instance.
    conta null (practice run) = off. Mirrors the session to the widgets and the Live Activity (the
    widget's own taps are registered by the server, not by this page). */
export function useVantQuickDefcon(conta: string | null, defcon: DefconParaEspelho) {
  useEspelhoQuick(conta, defcon);
}
