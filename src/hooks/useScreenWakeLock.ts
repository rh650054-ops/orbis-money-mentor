import { useEffect, useRef } from "react";

/**
 * Mantém a tela do celular LIGADA enquanto `active` for true (ex.: durante o DEFCON),
 * pra o usuário não precisar ficar destravando o aparelho pra registrar venda/abordagem.
 *
 * - Re-adquire o lock quando a aba volta a ficar visível (o lock cai quando some/minimiza).
 * - É silencioso se o aparelho não suportar (iOS antigo, modo economia, etc.).
 */
export function useScreenWakeLock(active: boolean) {
  const lockRef = useRef<any>(null);

  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await (navigator as any).wakeLock.request("screen");
        if (cancelled) {
          lock.release?.();
          return;
        }
        lockRef.current = lock;
        lock.addEventListener?.("release", () => {
          lockRef.current = null;
        });
      } catch {
        /* ignora: bateria baixa, sem permissão, não suportado */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !lockRef.current && !cancelled) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        lockRef.current?.release?.();
      } catch {
        /* ignore */
      }
      lockRef.current = null;
    };
  }, [active]);
}
