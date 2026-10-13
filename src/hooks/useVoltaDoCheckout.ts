import { useEffect, useRef, useState } from "react";
import { toast } from "@/shared/hooks/use-toast";
import { avisar } from "@/shared/lib/avisar";
import { checkoutAbertoEm, limparCheckoutAberto, EVENTO_CHECKOUT_ABERTO } from "@/shared/lib/checkout";

export const POLL_MS = 5_000;
/** Poll for this long after the checkout tap (Pix/card webhooks land in ~1 min). */
export const JANELA_POLL_MS = 10 * 60_000;
/** Focus/visibility re-checks keep working this long (boleto, paying later). */
export const JANELA_VOLTA_MS = 24 * 60 * 60_000;
/** Lets the success toast show before the reload/redirect. */
export const ATRASO_LIBERAR_MS = 1_200;

type Opcoes = {
  /** the paywall is on screen */
  ativo: boolean;
  /** true when the purchase is already active on the server */
  verificar: () => Promise<boolean>;
  /** called once on success (reload, redirect…) */
  aoLiberar: () => void;
};

/** While a paywall is visible and the user tapped a checkout link, re-checks the
 *  subscription when the app comes back to the front and polls every 5s for 10 min.
 *  On success: PT-BR toast, then `aoLiberar`. Stops on success or unmount. */
export function useVoltaDoCheckout({ ativo, verificar, aoLiberar }: Opcoes): void {
  const verificarRef = useRef(verificar);
  const aoLiberarRef = useRef(aoLiberar);
  useEffect(() => {
    verificarRef.current = verificar;
    aoLiberarRef.current = aoLiberar;
  });

  const [cliqueEm, setCliqueEm] = useState<number | null>(() => checkoutAbertoEm());
  useEffect(() => {
    const ouvir = () => setCliqueEm(checkoutAbertoEm() ?? Date.now());
    window.addEventListener(EVENTO_CHECKOUT_ABERTO, ouvir);
    return () => window.removeEventListener(EVENTO_CHECKOUT_ABERTO, ouvir);
  }, []);

  useEffect(() => {
    if (!ativo || cliqueEm == null) return;
    let vivo = true;
    let ocupado = false;
    let liberado = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let atraso: ReturnType<typeof setTimeout> | null = null;
    const parar = () => { if (timer) clearInterval(timer); timer = null; };

    const checar = async () => {
      if (!vivo || ocupado || liberado || Date.now() - cliqueEm > JANELA_VOLTA_MS) return;
      ocupado = true;
      try {
        const ok = await verificarRef.current();
        if (ok && vivo && !liberado) {
          liberado = true;
          parar();
          limparCheckoutAberto();
          toast({ title: "Pagamento confirmado! Liberando o app…" });
          atraso = setTimeout(() => aoLiberarRef.current(), ATRASO_LIBERAR_MS);
        }
      } catch (e) {
        avisar.silencioso("checkout: verificar na volta", e);
      } finally {
        ocupado = false;
      }
    };

    const aoVoltar = () => { if (document.visibilityState === "visible") void checar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    if (Date.now() - cliqueEm < JANELA_POLL_MS) {
      timer = setInterval(() => {
        if (Date.now() - cliqueEm >= JANELA_POLL_MS) return parar();
        void checar();
      }, POLL_MS);
    }

    return () => {
      vivo = false;
      parar();
      if (atraso) clearTimeout(atraso);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [ativo, cliqueEm]);
}
