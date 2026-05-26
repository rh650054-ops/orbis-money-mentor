import { useEffect, useState } from "react";

/**
 * Splash de abertura do Orbis: ~1s.
 * Logo gira e some assim que o app está pronto.
 * Mostra apenas uma vez por sessão (sessionStorage).
 */
export default function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("orbis_splash_shown") !== "1";
  });

  useEffect(() => {
    if (!visible) return;
    sessionStorage.setItem("orbis_splash_shown", "1");
    const t = setTimeout(() => setVisible(false), 1000);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background animate-orbis-splash-out"
      style={{ animationDelay: "850ms", animationFillMode: "forwards" }}
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
