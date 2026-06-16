import { useEffect, useRef } from "react";

/**
 * Re-executa `callback` sempre que o app/página volta a ficar em foco:
 * - aba/janela recebe foco (window "focus")
 * - documento volta a ficar visível (ex.: PWA retomado do segundo plano)
 *
 * Resolve o caso em que Dashboard, Relatório e Ranking ficavam com dados
 * antigos depois de uma sessão do DEFCON 4, porque só carregavam uma vez.
 *
 * O callback é guardado em ref para sempre chamar a versão mais recente sem
 * recriar os listeners a cada render. Opcionalmente desativável via `enabled`.
 */
export function useRefetchOnFocus(callback: () => void, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const run = () => callbackRef.current();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled]);
}
