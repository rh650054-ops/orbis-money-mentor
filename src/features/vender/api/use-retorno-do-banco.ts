/* Coming back from the bank's app. On a phone the vendor leaves the Vant to approve the
   connection in the bank's app; on the way back the system may have reloaded the Vant, and the
   Pluggy screen is gone without having said anything. If a connection was opened a few minutes
   ago and did not finish on this page, re-read the list of banks: the Pluggy webhook may already
   have saved it. This only READS the list. It saves nothing and treats nothing as up to date. */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { limparTentativa, tentativaPendente } from "@/components/conectar/pluggy";
import { venderKeys } from "./keys";

/** when to look again after coming back: now, then twice more while the bank finishes */
export const RELEITURAS_MS = [0, 6_000, 20_000];

export function useRetornoDoBanco(ativo: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!ativo) return;
    let relogios: number[] = [];
    const conferir = () => {
      if (document.visibilityState !== "visible" || relogios.length > 0 || !tentativaPendente()) return;
      relogios = RELEITURAS_MS.map((ms, i) => window.setTimeout(() => {
        void qc.invalidateQueries({ queryKey: venderKeys.all });
        if (i === RELEITURAS_MS.length - 1) { limparTentativa(); relogios = []; }
      }, ms));
    };
    conferir();
    document.addEventListener("visibilitychange", conferir);
    return () => {
      document.removeEventListener("visibilitychange", conferir);
      relogios.forEach((t) => window.clearTimeout(t));
    };
  }, [ativo, qc]);
}
