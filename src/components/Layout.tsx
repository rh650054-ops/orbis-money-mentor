import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, TrendingUp, Trophy, Clock, CheckSquare, Wallet, User, LogOut, ChevronDown, FileText } from "lucide-react";
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
import PWAInstallButton from "@/components/PWAInstallButton";
import OnboardingOrchestrator, { useOnboarding } from "@/components/onboarding/OnboardingOrchestrator";
import MorningCommitModal from "@/components/MorningCommitModal";
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
  { name: "Nova Venda", href: "/transactions", icon: TrendingUp, tourId: "" },
  { name: "Ritmo", href: "/daily-goals", icon: CheckSquare, tourId: "nav-ritmo" },
  { name: "Ranking", href: "/ranking", icon: Trophy, tourId: "nav-ranking" },
  { name: "Rotina", href: "/routine", icon: Clock, tourId: "nav-rotina" },
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

  // Show trial reminder during trial period
  useEffect(() => {
    if (!user || trialLoading || subscriptionLoading) return;
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

    // Skip checks while loading
    if (loading || trialLoading || subscriptionLoading || !user) return;

    const currentPath = location.pathname;
    const allowedPaths = ['/payment', '/benefits', '/auth', '/check-in'];
    
    // Fast redirect for expired trial WITHOUT active subscription
    const needsSubscription = trialStatus.isExpired && !subscriptionStatus.subscribed;
    if (needsSubscription && !allowedPaths.includes(currentPath)) {
      navigate("/payment", { replace: true });
      return;
    }

    // Check-in verification (non-blocking)
    if (currentPath !== '/check-in' && !trialStatus.isExpired) {
      checkNeedsCheckIn();
    }
  }, [user, loading, trialLoading, subscriptionLoading, trialStatus.isExpired, subscriptionStatus.subscribed, location.pathname, navigate]);

  const checkNeedsCheckIn = async () => {
    // Check-in desativado: não redirecionar mais para a tela de "Bom dia, Visionário"
    return;
  };

  const shouldShowTrialExpiredModal = 
    !trialLoading && 
    trialStatus.isExpired && 
    trialStatus.planStatus === 'expired' &&
    location.pathname !== '/payment';

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth");
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/80" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <span className="text-lg font-bold">O</span>
                </div>
                <span className="text-xl font-bold gradient-text">Orbis</span>
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
              {/* User Profile Dropdown */}
              {user && (
                <DropdownMenu open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2 h-9">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setIsProfileOpen(false); navigate("/profile"); }}>
                      <User className="w-4 h-4 mr-2" />
                      Perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setIsProfileOpen(false); navigate("/finances"); }}>
                      <Wallet className="w-4 h-4 mr-2" />
                      Financeiro
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setIsProfileOpen(false); navigate("/history"); }}>
                      <FileText className="w-4 h-4 mr-2" />
                      Histórico
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-500">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
      <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
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
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-black/95 backdrop-blur-xl supports-[backdrop-filter]:bg-black/90" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-16 px-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                {...(item.tourId ? { "data-tour": item.tourId } : {})}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs font-medium transition-all rounded-lg",
                  isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px]">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Floating Chat Button */}
      <FloatingChatButton />

      {/* Onboarding */}
      <OnboardingOrchestrator phase={phase} setPhase={setPhase} markDone={markDone} />

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
