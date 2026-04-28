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

createRoot(document.getElementById("root")!).render(<App />);
