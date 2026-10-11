/* ============================================================
   iPhone: barra de baixo "no meio da tela" (Rick, 11/10/2026)
   No app instalado (PWA) do iOS, quando o teclado fecha — ou o app volta do
   fundo — o Safari às vezes não devolve a tela ao tamanho cheio: os elementos
   fixos (barra de navegação, botão flutuante) ficam presos na altura que a
   tela tinha COM teclado, e o que está embaixo aparece pintado duas vezes.
   O conserto é o mesmo que o próprio Safari faz quando a pessoa rola: um
   "empurrão" de 1px na rolagem obriga o navegador a recalcular a tela.
   Só roda no iOS; não muda nada no Android nem no computador.
   ============================================================ */
import { useEffect } from "react";

export function ehIOS(ua = typeof navigator !== "undefined" ? navigator.userAgent : "", toques = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0): boolean {
  // iPad com iPadOS 13+ se apresenta como Mac — só que com tela de toque
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && toques > 1);
}

/** Força o Safari a recalcular a tela sem mudar onde a pessoa está na rolagem. */
export function recalcularTela(win: Window = window) {
  const x = win.scrollX;
  const y = win.scrollY;
  win.scrollTo(x, y + 1);
  win.scrollTo(x, y);
}

export function useIosViewportFix() {
  useEffect(() => {
    if (!ehIOS()) return;
    let timer: number | undefined;
    const agendar = () => {
      window.clearTimeout(timer);
      // o teclado leva ~250ms pra sumir; recalcula depois que ele saiu
      timer = window.setTimeout(() => recalcularTela(), 300);
    };
    const vv = window.visualViewport;
    const aoMudarViewport = () => {
      // voltou ao tamanho cheio (teclado fechou)
      if (vv && Math.abs(vv.height - window.innerHeight) < 4) agendar();
    };
    const aoVoltar = () => { if (document.visibilityState === "visible") agendar(); };

    document.addEventListener("focusout", agendar);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", agendar);
    window.addEventListener("orientationchange", agendar);
    vv?.addEventListener("resize", aoMudarViewport);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusout", agendar);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", agendar);
      window.removeEventListener("orientationchange", agendar);
      vv?.removeEventListener("resize", aoMudarViewport);
    };
  }, []);
}
