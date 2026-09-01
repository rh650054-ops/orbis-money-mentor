import { createRoot } from "react-dom/client";
import Root from "@/app/root";
import "./index.css";
import { setupOfflineSyncListeners } from "@/shared/lib/offline-sync";
import { captureReferralCoupon } from "@/shared/lib/checkout";
import { loadExtratoDeadline } from "@/shared/lib/extrato-config";

window.addEventListener("error", (event) => {
  console.error("[Orbis] Unhandled error:", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Orbis] Unhandled promise rejection:", event.reason);
});

// Captura o cupom do influenciador na entrada (ex: ?cupom=ZECK15) -> aplica depois no checkout
captureReferralCoupon();

// Setup offline sync listeners globally
setupOfflineSyncListeners();

// Carrega o horário-limite do extrato do banco (config mudável pelo admin) pro cache.
loadExtratoDeadline();

// Service worker do Orbis — registrado pra TODOS os usuários.
// Faz cache NETWORK-FIRST (com sinal sempre busca o build novo; o cache é só
// plano B quando não há internet), então o app abre offline SEM voltar o bug da
// tela preta (que vinha de cache-first servindo build velho). Também habilita as
// ações rápidas (Venda / Abordagem) na notificação da tela bloqueada no DEFCON.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .catch(() => {
      // best-effort — o app funciona normalmente mesmo sem o worker
    });
}


createRoot(document.getElementById("root")!).render(<Root />);

// PLACAR OFFLINE: pré-carrega o código da tela /offline enquanto há sinal, pra o
// service worker guardar o arquivo. Sem isso, a tela só existiria no servidor —
// e a primeira vez que o vendedor precisa dela é justamente SEM internet.
if (typeof navigator === "undefined" || navigator.onLine !== false) {
  const preload = () => { import("@/pages/ModoOffline").catch(() => {}); };
  if ("requestIdleCallback" in window) (window as any).requestIdleCallback(preload, { timeout: 8000 });
  else setTimeout(preload, 4000);
}
