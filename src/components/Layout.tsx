import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Zap, DollarSign, BarChart3, MessageCircle, Trophy, Clock, CheckSquare, Wallet, User, LogOut, ChevronDown, FileText, Building2, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import FloatingChatButton from "@/components/FloatingChatButton";
import TrialExpiredModal from "@/components/TrialExpiredModal";
import OfflineIndicator from "@/components/OfflineIndicator";
import PWAInstallButton from "@/components/PWAInstallButton";
import OnboardingOrchestrator, { useOnboarding } from "@/components/onboarding/OnboardingOrchestrator";
import MorningCommitModal from "@/components/MorningCommitModal";
import BackButton from "@/components/BackButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: Home, tourId: "" },
  { name: "Ritmo", href: "/daily-goals", icon: Zap, tourId: "nav-ritmo" },
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
  const onboardingCompleto = localStorage.getItem('orbis_onboarding_completo') === 'true';

  // Show trial reminder during trial period
  useEffect(() => {
    if (!user || trialLoading || subscriptionLoading) return;
    if (!onboardingCompleto) return;
    if (subscriptionStatus.subscribed) return; // Don't show for subscribers
    
    const daysRemaining = trialStatus.daysRemaining ?? 0;
    
    // Show reminder if trial is active and has 3 or fewer days remaining
    if (trialStatus.isTrialActive && daysRemaining <= 3 && daysRemaining > 0) {
      const lastReminderDate = localStorage.getItem('lastTrialReminder');
      const today = new Date().toISOString().split('T')[0];
      
      // Show once per day
      if (lastReminderDate !== today) {
        toast({
          title: `⚠️ Seu teste acaba em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}!`,
          description: "Assine agora por R$19,90/mês e mantenha acesso a todos os recursos.",
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
    const allowedPaths = ['/payment', '/benefits', '/auth', '/check-in'];
    
    // Fast redirect for expired trial WITHOUT active subscription (admins are exempt)
    const needsSubscription = trialStatus.isExpired && !subscriptionStatus.subscribed && !isAdmin;
    if (needsSubscription && !allowedPaths.includes(currentPath)) {
      navigate("/payment", { replace: true });
      return;
    }

    // Check-in verification (non-blocking)
    if (currentPath !== '/check-in' && !trialStatus.isExpired) {
      checkNeedsCheckIn();
    }
  }, [user, loading, trialLoading, subscriptionLoading, trialStatus.isExpired, subscriptionStatus.subscribed, location.pathname, navigate, onboardingCompleto]);

  const checkNeedsCheckIn = async () => {
    // Check-in desativado: não redirecionar mais para a tela de "Bom dia, Visionário"
    return;
  };

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
    return <OnboardingOrchestrator phase={phase} setPhase={setPhase} markDone={markDone} />;
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Offline Indicator */}
      <OfflineIndicator />
      <header className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/80" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center space-x-2">
                <img src="/orbis-logo.png" alt="" className="w-8 h-8 object-contain" />
                <img src="/orbis-wordmark.png" alt="Orbis" className="h-5 object-contain" />
              </Link>
              {isAdmin && (
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
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
      <main className="container mx-auto px-4 pt-2 pb-24 md:pt-8 md:pb-8">
        {/* Back button - hidden on Dashboard and pages that already have their own back button */}
        {!["/", "/my-account", "/settings", "/products", "/rewards", "/benefits"].includes(location.pathname) && (
          <div className="mb-2 md:hidden">
            <BackButton />
          </div>
        )}
        {/* Trial Warning Banner */}
        {!subscriptionLoading && !subscriptionStatus.subscribed && trialStatus.isTrialActive && trialStatus.daysRemaining !== null && trialStatus.daysRemaining <= 3 && (
          <div className="mb-6 p-4 rounded-lg bg-warning/10 border-2 border-warning/30 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div className="flex-1">
                <h3 className="font-semibold text-warning mb-1">
                  Seu teste gratuito acaba em {trialStatus.daysRemaining} {trialStatus.daysRemaining === 1 ? 'dia' : 'dias'}!
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Após o término, você perderá acesso a todos os dados e funcionalidades. Assine agora para manter tudo salvo!
                </p>
                <Button 
                  size="sm" 
                  onClick={() => navigate('/payment')}
                  className="bg-warning hover:bg-warning/90 text-warning-foreground"
                >
                  Assinar por R$19,90/mês
                </Button>
              </div>
            </div>
          </div>
        )}
        {children}
      </main>

      {/* Mobile bottom navigation - Fixed */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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

        <div className="border-t border-border bg-black/95 backdrop-blur-xl supports-[backdrop-filter]:bg-black/90">
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
                    "flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-all",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]")} />
                  <span className="text-[10px]">{item.name}</span>
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
      {!trialLoading && !subscriptionLoading && trialStatus.isExpired && !subscriptionStatus.subscribed && !['/payment', '/benefits', '/auth', '/check-in'].includes(location.pathname) && (
        <TrialExpiredModal 
          isOpen={true} 
          onClose={() => navigate('/payment', { replace: true })} 
        />
      )}
    </div>
  );
}
