import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupOfflineSyncListeners } from "./lib/offlineSync";

// Setup offline sync listeners globally
setupOfflineSyncListeners();

createRoot(document.getElementById("root")!).render(<App />);
