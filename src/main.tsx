import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupOfflineSyncListeners } from "./lib/offlineSync";

function RuntimeGuards() {
  useEffect(() => {
    const cleanupOfflineSync = setupOfflineSyncListeners();

    if (import.meta.env.DEV && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      }).catch(() => undefined);

      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            void caches.delete(key);
          });
        }).catch(() => undefined);
      }
    }

    return cleanupOfflineSync;
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <>
    <RuntimeGuards />
    <App />
  </>
);
