import { useEffect, useRef } from "react";

interface QuickNotifOptions {
  /** Total de vendas do dia (pra mostrar na notificação). */
  totalSales: number;
  /** Total de abordagens do dia. */
  totalApproaches: number;
  /** Valor que a "Venda rápida" vai lançar (valor mais frequente do dia). 0 = ainda sem valor. */
  quickValue: number;
  /** Registra uma venda rápida (no valor de quickValue). */
  onVenda: () => void;
  /** Registra uma abordagem. */
  onAbordagem: () => void;
}

/**
 * Notificação fixa na tela bloqueada durante o DEFCON, com botões "Venda" e
 * "Abordagem", pra o vendedor registrar SEM destravar o celular.
 *
 * - Mostra/atualiza a notificação enquanto `active` for true (fase "running").
 * - Ouve as mensagens do service worker (toque no botão) e chama onVenda/onAbordagem.
 * - Fallback: se o app estava fechado, o worker abre /defcon?quick=venda|abordagem
 *   e a gente registra ao carregar.
 * - Silencioso se o aparelho não suportar (iOS sem "Adicionar à tela", etc.).
 */
export function useDefconQuickNotification(active: boolean, opts: QuickNotifOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const supported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator;

  // 1) Toque no botão da notificação -> service worker manda mensagem -> registra de verdade.
  useEffect(() => {
    if (!supported) return;
    const onMsg = (e: MessageEvent) => {
      const m = (e && e.data) || {};
      if (m.type !== "orbis-defcon-quick") return;
      if (m.action === "venda") optsRef.current.onVenda();
      else if (m.action === "abordagem") optsRef.current.onAbordagem();
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [supported]);

  // 2) Fallback do app fechado: /defcon?quick=venda|abordagem -> registra 1x ao abrir.
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("quick");
      if (q === "venda" || q === "abordagem") {
        url.searchParams.delete("quick");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
        if (q === "venda") optsRef.current.onVenda();
        else optsRef.current.onAbordagem();
      }
    } catch {
      /* ignora */
    }
  }, [active]);

  // 3) Esconde a notificação ao sair da tela (desmontar).
  useEffect(() => {
    if (!supported) return;
    return () => {
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "orbis-defcon-hide" }))
        .catch(() => {});
    };
  }, [supported]);

  // 4) Pede permissão e mostra/atualiza a notificação enquanto ativo.
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    const hide = () => {
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "orbis-defcon-hide" }))
        .catch(() => {});
    };

    if (!active) {
      hide();
      return;
    }

    (async () => {
      try {
        let perm = Notification.permission;
        if (perm === "default") perm = await Notification.requestPermission();
        if (cancelled || perm !== "granted") return;
        const reg = await navigator.serviceWorker.ready;
        if (cancelled) return;
        reg.active?.postMessage({
          type: "orbis-defcon-show",
          data: {
            vendas: optsRef.current.totalSales,
            abordagens: optsRef.current.totalApproaches,
            quickValue: optsRef.current.quickValue,
          },
        });
      } catch {
        /* ignora */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supported, active, opts.totalSales, opts.totalApproaches, opts.quickValue]);
}
