import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, TrendingUp, Target, Clock, CheckSquare, Wallet, User, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import FloatingChatButton from "@/components/FloatingChatButton";
import TrialExpiredModal from "@/components/TrialExpiredModal";
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
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Nova Venda", href: "/transactions", icon: TrendingUp },
  { name: "Histórico", href: "/history", icon: Target },
  { name: "Rotina", href: "/routine", icon: Clock },
  { name: "Finanças", href: "/finances", icon: Wallet },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { trialStatus, loading: trialLoading } = useTrialStatus(user?.id);
  const { status: subscriptionStatus, loading: subscriptionLoading } = useSubscription(user?.id);
  const { toast } = useToast();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("last_check_in_date")
        .eq("user_id", user.id)
        .single();

      const today = new Date().toISOString().split('T')[0];
      if (!profile?.last_check_in_date || profile.last_check_in_date !== today) {
        navigate("/check-in", { replace: true });
      }
    } catch (error) {
      console.error("Check-in verification error:", error);
    }
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <span className="text-lg font-bold">O</span>
                </div>
                <span className="text-xl font-bold gradient-text">Orbis</span>
              </Link>
              
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
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[999] border-t border-border/40 backdrop-blur-xl bg-background/95 safe-area-bottom" style={{ position: 'fixed' }}>
        <div className="flex items-center justify-around px-2 py-3 pb-safe">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-smooth",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "drop-shadow-glow-primary")} />
                <span className="text-xs font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Floating Chat Button */}
      <FloatingChatButton />

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
