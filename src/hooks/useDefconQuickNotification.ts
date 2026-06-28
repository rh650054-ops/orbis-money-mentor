import { useEffect, useRef } from "react";

interface QuickNotifOptions {
  /** Total de vendas do dia. */
  totalSales: number;
  /** Total de abordagens do dia. */
  totalApproaches: number;
  /** Valor da "venda rápida" (valor mais frequente do dia). 0 = ainda sem valor. */
  quickValue: number;
  /** Valor da venda mais recente (pra notificação "Venda realizada"). */
  lastSaleAmount: number;
  /** Registra uma venda rápida. */
  onVenda: () => void;
  /** Registra uma abordagem. */
  onAbordagem: () => void;
}

/**
 * Notificação na tela bloqueada durante o DEFCON pra registrar sem destravar.
 *
 * - Android: UMA notificação com DOIS botões (Venda/Abordagem).
 * - iPhone: o iOS ignora botão de ação em notificação web, então mostramos DUAS
 *   notificações que registram por TOQUE.
 * - Em ambos: dispara "✅ Venda realizada! Valor: R$X" (estilo Kiwify) a cada venda.
 * - Silencioso se o aparelho não suportar (iOS sem "Adicionar à tela inicial", etc.).
 */
export function useDefconQuickNotification(active: boolean, opts: QuickNotifOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const supported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator;

  // Aparelho: iPhone/iPad usam toque (sem botão); resto usa botões.
  const mode = (() => {
    if (typeof navigator === "undefined") return "buttons";
    const ua = navigator.userAgent || "";
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
    return isIOS ? "tap" : "buttons";
  })();

  // 1) Toque no botão/notificação -> service worker avisa -> registra de verdade.
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

  // 3) Esconde as notificações ao sair da tela (desmontar).
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
            mode,
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
  }, [supported, active, mode, opts.totalSales, opts.totalApproaches, opts.quickValue]);

  // 5) "✅ Venda realizada!" a cada nova venda (estilo Kiwify), iPhone e Android.
  const prevSalesRef = useRef<number | null>(null);
  useEffect(() => {
    if (!supported) return;
    const cur = opts.totalSales;
    if (prevSalesRef.current === null) {
      prevSalesRef.current = cur; // pula o carregamento inicial
      return;
    }
    if (active && cur > prevSalesRef.current) {
      const amount = optsRef.current.lastSaleAmount || optsRef.current.quickValue || 0;
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "orbis-venda-realizada", data: { amount } }))
        .catch(() => {});
    }
    prevSalesRef.current = cur;
  }, [supported, active, opts.totalSales]);
}
