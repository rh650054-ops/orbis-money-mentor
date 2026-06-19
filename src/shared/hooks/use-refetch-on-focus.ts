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
export function useRefetchOnFocus(
  callback: () => void,
  enabled = true,
  minIntervalMs = 60_000,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    // Throttle: no máximo 1 recarga por minuto, mesmo trocando de aba várias
    // vezes. Sem isso, cada foco refazia consultas pesadas (dashboard, ranking
    // com avatares) — principal causa de gasto de banda (egress) do Supabase.
    const run = () => {
      const now = Date.now();
      if (now - lastRunRef.current < minIntervalMs) return;
      lastRunRef.current = now;
      callbackRef.current();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, minIntervalMs]);
}
