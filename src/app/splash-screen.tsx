import { useEffect, useState } from "react";

/**
 * Splash de abertura do Orbis.
 * Logo gira e cobre a tela INTEIRA (inclusive a barra de baixo) e só some
 * quando o app sinaliza que está pronto (evento "orbis:ready", disparado pela
 * primeira tela ao montar). Isso evita a barra de navegação "piscar" sozinha
 * antes do conteúdo carregar.
 *
 * Regras:
 *  - MIN_HOLD_MS: tempo mínimo na tela (deixa a animação da logo tocar).
 *  - Some assim que (app pronto) E (tempo mínimo passou).
 *  - MAX_WAIT_MS: trava de segurança — some mesmo se o sinal não chegar.
 * Mostra apenas uma vez por sessão (sessionStorage).
 */
const MIN_HOLD_MS = 750; // mínimo cobrindo a tela
const MAX_WAIT_MS = 2500; // limite de segurança
const FADE_MS = 320; // fade suave de saída

export default function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("orbis_splash_shown") !== "1";
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem("orbis_splash_shown", "1");

    let appReady = false;
    let minPassed = false;
    let done = false;
    let hideTimer: ReturnType<typeof setTimeout>;

    const startFade = () => {
      if (done) return;
      done = true;
      setFading(true);
      hideTimer = setTimeout(() => setVisible(false), FADE_MS);
    };
    const tryDismiss = () => {
      if (appReady && minPassed) startFade();
    };

    const onReady = () => {
      appReady = true;
      tryDismiss();
    };
    window.addEventListener("orbis:ready", onReady);

    const minTimer = setTimeout(() => {
      minPassed = true;
      tryDismiss();
    }, MIN_HOLD_MS);
    const maxTimer = setTimeout(startFade, MAX_WAIT_MS);

    return () => {
      window.removeEventListener("orbis:ready", onReady);
      clearTimeout(minTimer);
      clearTimeout(maxTimer);
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
