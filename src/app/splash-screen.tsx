import { useEffect, useState } from "react";

/**
 * Splash de abertura do Orbis.
 * Logo gira e some assim que o app está pronto.
 * Mostra apenas uma vez por sessão (sessionStorage).
 *
 * IMPORTANTE: o splash fica 100% OPACO durante todo o HOLD, cobrindo a tela
 * inteira (inclusive a barra de navegação de baixo). Só depois disso ele faz
 * um fade rápido — assim, quando some, a página já carregou atrás dele e o
 * app aparece inteiro de uma vez, sem a barra de baixo "piscando" antes.
 */
const HOLD_MS = 1200; // tempo cobrindo a tela inteira (deixa o app carregar atrás)
const FADE_MS = 320;  // fade suave de saída

export default function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("orbis_splash_shown") !== "1";
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem("orbis_splash_shown", "1");
    // Mantém opaco durante o HOLD, então inicia o fade.
    const fadeTimer = setTimeout(() => setFading(true), HOLD_MS);
    // Remove só depois do fade terminar (sem corte seco).
    const hideTimer = setTimeout(() => setVisible(false), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      style={{
        opacity: fading ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        willChange: "opacity",
      }}
      aria-hidden="true"
    >
      <img
        src="/orbis-logo.png"
        alt=""
        className="w-24 h-24 object-contain animate-orbis-splash-spin"
      />
    </div>
  );
}
