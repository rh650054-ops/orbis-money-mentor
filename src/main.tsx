import { createRoot } from "react-dom/client";
import Root from "@/app/root";
import "./index.css";
import { setupOfflineSyncListeners } from "@/shared/lib/offline-sync";

window.addEventListener("error", (event) => {
  console.error("[Orbis] Unhandled error:", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Orbis] Unhandled promise rejection:", event.reason);
});

// Setup offline sync listeners globally
setupOfflineSyncListeners();

// One-time cleanup of the old vite-plugin-pwa service worker that was caching
// a broken build (tela preta no app publicado). We only register the
// kill-switch /sw.js when an old service worker is actually present —
// otherwise new visitors would get caught in a register → navigate → reload
// loop and never see the app.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      if (registrations.length === 0) return;
      return navigator.serviceWorker.register("/sw.js", { scope: "/" });
    })
    .catch(() => {
      // ignore — best-effort cleanup
    });
}


createRoot(document.getElementById("root")!).render(<Root />);
