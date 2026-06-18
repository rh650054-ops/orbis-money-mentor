import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Zap, DollarSign, BarChart3, MessageCircle, Trophy, Clock, CheckSquare, Wallet, User, LogOut, ChevronDown, FileText, Building2, UserCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import FloatingChatButton from "@/components/FloatingChatButton";
import TrialExpiredModal from "@/components/TrialExpiredModal";
import OfflineIndicator from "@/components/OfflineIndicator";
import PWAInstallButton from "@/components/PWAInstallButton";
import OnboardingOrchestrator, { useOnboarding } from "@/components/onboarding/OnboardingOrchestrator";
import MorningCommitModal from "@/components/MorningCommitModal";
import BackButton from "@/shared/components/back-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: Home, tourId: "" },
  { name: "Foco", href: "/daily-goals", icon: Zap, tourId: "nav-ritmo" },
  { name: "Vender", href: "/bank-connections", icon: DollarSign, tourId: "nav-banco", isCenter: true },
  { name: "Relatório", href: "/insights", icon: BarChart3, tourId: "nav-dados" },
  { name: "Perfil", href: "/profile", icon: UserCircle, tourId: "nav-perfil" },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { trialStatus, loading: trialLoading } = useTrialStatus(user?.id);
  const { status: subscriptionStatus, loading: subscriptionLoading } = useSubscription(user?.id);
  const { whitelisted: isAdmin, role: adminRole } = useAdminAccess(user?.id);
  const { toast } = useToast();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { phase, setPhase, markDone } = useOnboarding();
  const [onboardingCompleto, setOnboardingCompleto] = useState(
    () => typeof window !== "undefined" && localStorage.getItem('orbis_onboarding_completo') === 'true'
  );
  const [onboardingChecked, setOnboardingChecked] = useState(
    () => typeof window !== "undefined" && localStorage.getItem('orbis_onboarding_completo') === 'true'
  );
  useEffect(() => {
    const sync = () => setOnboardingCompleto(localStorage.getItem('orbis_onboarding_completo') === 'true');
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  // Usuário já cadastrado: se a conta já tem dados de onboarding no banco, pula o onboarding
  // (vale em qualquer aparelho/navegador, pois o dado fica na conta e não no localStorage)
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem('orbis_onboarding_completo') === 'true') {
      setOnboardingChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nickname, monthly_goal")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data && (data.nickname || (data.monthly_goal ?? 0) > 0)) {
        localStorage.setItem('orbis_onboarding_completo', 'true');
        localStorage.setItem('orbis_onboarding_completed', 'true');
        setOnboardingCompleto(true);
      }
      setOnboardingChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);
  const trialDismissedRef = useRef(
    typeof window !== "undefined" && sessionStorage.getItem('trialModalDismissed') === 'true'
  );
  const [trialModalDismissed, setTrialModalDismissed] = useState(trialDismissedRef.current);

  const handleDismissTrialModal = () => {
    sessionStorage.setItem('trialModalDismissed', 'true');
    trialDismissedRef.current = true;
    setTrialModalDismissed(true);
  };

  // Show trial reminder during trial period
  useEffect(() => {
    if (!user || trialLoading || subscriptionLoading) return;
    if (!onboardingCompleto) return;
    if (subscriptionStatus.subscribed) return; // Don't show for subscribers
    
    const daysRemaining = trialStatus.daysRemaining ?? 0;
    
    // Show reminder if trial is active and has 3 or fewer days remaining
    if (trialStatus.isTrialActive && daysRemaining <= 3 && daysRemaining > 0) {
      const lastReminderDate = localStorage.getItem('lastTrialReminder');
      const today = new Date().toISOString().split('T')[0]!;
      
      // Show once per day
      if (lastReminderDate !== today) {
        toast({
          title: `🔥 Faltam ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} do seu acesso grátis`,
          description: "Você já começou a dominar seus números. Mantém o Orbis por R$0,99 por dia (R$29,99/mês) e não perde o ritmo.",
          duration: 8000,
        });
        localStorage.setItem('lastTrialReminder', today);
      }
    }
  }, [user, trialStatus.isTrialActive, trialStatus.daysRemaining, subscriptionStatus.subscribed, trialLoading, subscriptionLoading, toast]);

  useEffect(() => {
    // Fast redirect for non-authenticated users
    if (!loading && !user) {
      navigate("/auth", { replace: true });
      return;
    }

    // Block all redirects during onboarding
    if (!onboardingCompleto) return;

    // Skip checks while loading
    if (loading || trialLoading || subscriptionLoading || !user) return;

    const currentPath = location.pathname;
    const allowedPaths = ['/payment', '/benefits', '/auth'];
    
    // Fast redirect for expired trial WITHOUT active subscription (admins are exempt)
    // Use ref (synchronous) to avoid race condition with dismiss click
    const needsSubscription = trialStatus.isExpired && !subscriptionStatus.subscribed && !isAdmin;
    if (needsSubscription && !trialDismissedRef.current && !allowedPaths.includes(currentPath)) {
      navigate("/payment", { replace: true });
      return;
    }

  }, [user, loading, trialLoading, subscriptionLoading, trialStatus.isExpired, subscriptionStatus.subscribed, location.pathname, navigate, onboardingCompleto]);

  const shouldShowTrialExpiredModal =
    onboardingCompleto &&
    !trialLoading &&
    trialStatus.isExpired &&
    trialStatus.planStatus === 'expired' &&
    !isAdmin &&
    location.pathname !== '/payment';

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth");
  };

  // If onboarding not complete, render ONLY the onboarding
  if (!onboardingCompleto && phase !== "done") {
    // Espera a checagem no banco antes de mostrar o onboarding,
    // pra não exibir o onboarding pra quem já é cadastrado
    if (user && !onboardingChecked) {
      return <div className="min-h-[100dvh] bg-background" />;
    }
    return <OnboardingOrchestrator phase={phase} setPhase={setPhase} markDone={markDone} />;
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Offline Indicator */}
      <OfflineIndicator />
      <header className="hidden md:block sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/80" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile: sem logo, header limpo. Desktop: logo discreta */}
              <Link to="/" className="hidden md:flex items-center space-x-2">
                <img src="/orbis-logo.png" alt="" className="w-7 h-7 object-contain opacity-80" />
                <img src="/orbis-wordmark.png" alt="Orbis" className="h-4 object-contain opacity-80" />
              </Link>
              {/* Mobile: ícone pequeno só como âncora para Dashboard */}
              <Link to="/" className="md:hidden flex items-center" aria-label="Início">
                <img src="/orbis-logo.png" alt="" className="w-6 h-6 object-contain opacity-60" />
              </Link>
              {isAdmin && (
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0",
                  adminRole === "admin"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-muted text-muted-foreground border border-border"
                )}>
                  {adminRole}
                </span>
              )}
            </div>
            
            {/* Desktop Navigation */}
            <div className="flex items-center gap-4">
              <nav className="hidden md:flex items-center space-x-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={cn(
                        "flex items-center space-x-2 px-4 py-2 rounded-lg transition-smooth",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              <PWAInstallButton />
            </div>
          </div>
        </div>
      </header>


      {/* Main Content */}
      <main
        className="container mx-auto px-4 pt-2 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-8 md:pb-8"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)' }}
      >
        {/* Back button - hidden on Dashboard and pages that already have their own back button */}
        {!["/", "/my-account", "/settings", "/products", "/rewards", "/benefits"].includes(location.pathname) && (
          <div className="mb-2 md:hidden">
            <BackButton to={location.pathname === "/profile" ? "/" : undefined} />
          </div>
        )}
        {/* Trial Warning Banner */}
        {!subscriptionLoading && !subscriptionStatus.subscribed && trialStatus.isTrialActive && trialStatus.daysRemaining !== null && trialStatus.daysRemaining <= 3 && (
          <div className="mb-6 p-4 rounded-lg bg-warning/10 border-2 border-warning/30 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔥</div>
              <div className="flex-1">
                <h3 className="font-semibold text-warning mb-1">
                  Faltam {trialStatus.daysRemaining} {trialStatus.daysRemaining === 1 ? 'dia' : 'dias'} do seu acesso grátis
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Seu histórico, sua constância e seu lugar no ranking estão sendo construídos. Quando o teste acabar, isso trava. Mantenha tudo por menos de R$1 por dia.
                </p>
                <Button 
                  size="sm" 
                  onClick={() => navigate('/payment')}
                  className="bg-warning hover:bg-warning/90 text-warning-foreground"
                >
                  Quero continuar — R$29,99/mês
                </Button>
              </div>
            </div>
          </div>
        )}
        {children}
      </main>

      {/* Mobile bottom navigation - Fixed */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        {/* Notch SVG para o botão central */}
        <div className="relative">
          <svg
            className="absolute -top-[1px] left-1/2 -translate-x-1/2 pointer-events-none"
            width="88"
            height="32"
            viewBox="0 0 88 32"
            fill="none"
          >
            <path
              d="M0 0 C 18 0, 22 32, 44 32 C 66 32, 70 0, 88 0 Z"
              fill="hsl(var(--background))"
            />
          </svg>
        </div>

        <div
          className="border-t border-border bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/90"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="grid grid-cols-5 items-end h-16 px-1 relative">
            {navigation.map((item, idx) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;

              // Center CTA - sifrão dourado flutuante
              if (item.isCenter) {
                return (
                  <div key={item.name} className="flex justify-center">
                    <Link
                      to={item.href}
                      {...(item.tourId ? { "data-tour": item.tourId } : {})}
                      className="absolute left-1/2 -translate-x-1/2 -top-7 group"
                      aria-label={item.name}
                    >
                      <div className="relative">
                        {/* Halo externo */}
                        <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl scale-110 group-hover:scale-125 transition-transform" />
                        {/* Anel sutil */}
                        <div className="absolute -inset-1 rounded-full border border-primary/40" />
                        {/* Botão principal */}
                        <div
                          className={cn(
                            "relative w-16 h-16 rounded-full flex items-center justify-center",
                            "bg-gradient-to-br from-primary to-[hsl(45_100%_38%)]",
                            "shadow-[0_8px_24px_-4px_hsl(var(--primary)/0.6),inset_0_1px_0_hsl(0_0%_100%/0.25)]",
                            "transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
                          )}
                        >
                          <Icon className="h-7 w-7 text-primary-foreground" strokeWidth={2.75} />
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  {...(item.tourId ? { "data-tour": item.tourId } : {})}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-[colors,transform,opacity]",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]")} />
                  <span className="text-xs">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Floating Chat Button */}
      <FloatingChatButton />


      {/* Morning Commit Modal */}
      {user && phase === "done" && (
        <MorningCommitModal userId={user.id} onDismiss={() => {}} />
      )}

      {/* Trial Expired Modal - Only show if trial expired AND no active subscription */}
      {!trialLoading && !subscriptionLoading && trialStatus.isExpired && !subscriptionStatus.subscribed && !trialModalDismissed && !['/payment', '/benefits', '/auth', '/check-in'].includes(location.pathname) && (
        <TrialExpiredModal
          isOpen={true}
          onClose={handleDismissTrialModal}
        />
      )}
    </div>
  );
}
