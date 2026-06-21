import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import TrialExpiredModal from "@/components/TrialExpiredModal";

// Telas liberadas mesmo com a assinatura expirada (pra gerenciar a conta e assinar).
// Em qualquer OUTRA tela, o aviso de bloqueio aparece pra quem expirou e nao assinou.
const FREE_PATHS = [
  "/auth",
  "/payment",
  "/benefits",
  "/install",
  "/force-password-change",
  "/forgot-password",
  "/reset-password",
  "/profile",
  "/my-account",
  "/settings",
];

export default function PaywallGate() {
  const { user, loading } = useAuth();
  const { trialStatus, loading: trialLoading } = useTrialStatus(user?.id);
  const { status, loading: subLoading } = useSubscription(user?.id);
  const { whitelisted: isAdmin } = useAdminAccess(user?.id);
  const location = useLocation();

  // Enquanto carrega ou sem usuario logado, nao bloqueia nada.
  if (loading || trialLoading || subLoading || !user) return null;

  const blocked =
    trialStatus.isExpired &&
    !status.subscribed &&
    !isAdmin &&
    !FREE_PATHS.includes(location.pathname);

  if (!blocked) return null;

  return <TrialExpiredModal isOpen={true} />;
}
