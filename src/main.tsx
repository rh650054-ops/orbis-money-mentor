import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupOfflineSyncListeners } from "./lib/offlineSync";

window.addEventListener("error", (event) => {
  console.error("[Orbis] Unhandled error:", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Orbis] Unhandled promise rejection:", event.reason);
});

// Setup offline sync listeners globally
setupOfflineSyncListeners();

// Cleanup of the old vite-plugin-pwa service worker that was caching a
// broken build (tela preta no app publicado). We force the kill-switch
// /sw.js to install — it then unregisters itself and clears all caches.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .catch(() => {
      // ignore — best-effort cleanup
    });
}

createRoot(document.getElementById("root")!).render(<App />);
