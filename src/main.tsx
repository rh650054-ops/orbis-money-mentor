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
// NÃO faz cache (não tem listener de "fetch"), então não há como voltar o bug
// da tela preta (servir um build velho). Ele só habilita as ações rápidas
// (Venda / Abordagem) na notificação da tela bloqueada durante o DEFCON e
// limpa, no activate, qualquer cache legado do worker antigo.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .catch(() => {
      // best-effort — o app funciona normalmente mesmo sem o worker
    });
}


createRoot(document.getElementById("root")!).render(<Root />);
