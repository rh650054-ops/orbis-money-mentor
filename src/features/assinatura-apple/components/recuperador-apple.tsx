import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { definirContaDaCompra, fluxoDoApp } from "../api/fluxo-do-app";
import { EVENTO_APPLE_LIBEROU } from "../api/use-compra-apple";
import { ponteApple } from "../lib/ponte";
import type { ResultadoCompra } from "../types";

/** Runs in the background of the iPhone app, with no screen:
    - on launch, on login, when the app comes back and when the internet returns, it sends to the
      server every paid transaction StoreKit still holds (a purchase whose validation failed);
    - it listens to what Apple delivers later: a renewal, a refund, the approval of a pending purchase.
    It never opens a purchase. */
export function RecuperadorApple() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const conta = user?.id ?? null;
  useEffect(() => {
    definirContaDaCompra(conta);
    const ponte = ponteApple(), fluxo = fluxoDoApp();
    if (!ponte || !fluxo || !conta) return;
    let vivo = true;
    const avisar = (rs: ResultadoCompra[]) => {
      if (!vivo || !rs.some((r) => r.estado === "liberada")) return;
      void qc.invalidateQueries();
      window.dispatchEvent(new CustomEvent(EVENTO_APPLE_LIBEROU));
    };
    const rodar = () => void fluxo.recuperar().then(avisar).catch(() => undefined);
    const aoVoltar = () => { if (document.visibilityState === "visible") rodar(); };
    rodar();
    const escuta = ponte.addListener("transacao", (t) => void fluxo.processar(t).then((r) => avisar([r])).catch(() => undefined));
    window.addEventListener("online", rodar);
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      void escuta.then((h) => h.remove()).catch(() => undefined);
      window.removeEventListener("online", rodar);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [conta, qc]);
  return null;
}
