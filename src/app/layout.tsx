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
import { ExtratoReminder } from "@/components/competitions/ExtratoReminder";
import { WeeklyChallengeTicket, DesafioFluxoBar } from "@/components/competitions/WeeklyChallenge";
import TrialExpiredModal from "@/components/TrialExpiredModal";
import OfflineIndicator from "@/components/OfflineIndicator";
import PWAInstallButton from "@/components/PWAInstallButton";
import MissionOrchestrator from "@/components/onboarding/mission/MissionOrchestrator";
import ScreenCoach from "@/components/onboarding/ScreenCoach";
import MorningCommitModal from "@/components/MorningCommitModal";
import AceiteTermosModal from "@/components/AceiteTermosModal";
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
  const navActiveIndex = navigation.findIndex((i) => i.href === location.pathname);
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { trialStatus, loading: trialLoading } = useTrialStatus(user?.id);
  const { status: subscriptionStatus, loading: subscriptionLoading } = useSubscription(user?.id);
  const { whitelisted: isAdmin, role: adminRole } = useAdminAccess(user?.id);
  const { toast } = useToast();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // Conclusão do onboarding é POR USUÁRIO (chave com user.id) + banco como fonte
  // de verdade. Antes era uma flag GLOBAL no localStorage — por isso uma conta
  // nova no mesmo navegador "herdava" o onboarding concluído de outra conta.
  const [onboardingCompleto, setOnboardingCompleto] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  // Progresso da Missão de Boas-Vindas (retomada cross-device)
  const [missionStep, setMissionStep] = useState(0);
  const [missionNickname, setMissionNickname] = useState<string | null>(null);

  // Usuário já cadastrado: se a conta já tem dados de onboarding no banco, pula o onboarding
  // (vale em qualquer aparelho/navegador, pois o dado fica na conta e não no localStorage)
  useEffect(() => {
    if (!user) return;
    const doneKey = `orbis_mission_completed_${user.id}`;
    let cancelled = false;
    (async () => {
      // Lê SEMPRE no banco — precisa pegar must_change_password mesmo de quem já
      // concluiu o onboarding (a senha temporária do admin é gerada depois). Sem
      // o atalho de localStorage aqui, senão a flag não era lida pra esses usuários.
      const { data } = await supabase.from("profiles")
        .select("nickname, onboarding_completed, onboarding_step, must_change_password")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      // Senha temporária do admin: força a troca (redirecionamento no efeito abaixo).
      setMustChangePassword(data?.must_change_password === true);
      // Fonte de verdade: a flag do banco DESTE usuário.
      if (data?.onboarding_completed === true) {
        localStorage.setItem(doneKey, 'true');
        setOnboardingCompleto(true);
      } else {
        // Conta nova / onboarding não concluído: mostra a missão do começo.
        setMissionStep(data?.onboarding_step ?? 0);
        setMissionNickname(data?.nickname ?? null);
        setOnboardingCompleto(false);
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
    // Pula só pra quem REALMENTE paga (ou demo). No teste, subscribed=true mas
    // status="trial" — então checamos o status, não só o subscribed.
    if (subscriptionStatus.subscribed && subscriptionStatus.status !== "trial") return;
    
    const daysRemaining = trialStatus.daysRemaining ?? 0;
    const shownDays = Math.min(daysRemaining, 3); // teste é de 3 dias (no 1o dia da pra 4)

    // Mostra o lembrete durante todo o teste (não assinante e não expirado).
    // SEM teto de "<= 3 dias" — conta nova calcula 4 dias e o banner sumia no 1o dia.
    if (trialStatus.planStatus !== 'active' && !trialStatus.isExpired && daysRemaining > 0) {
      const lastReminderDate = localStorage.getItem('lastTrialReminder');
      const today = new Date().toISOString().split('T')[0]!;
      
      // Show once per day
      if (lastReminderDate !== today) {
        toast({
          title: `🔥 Faltam ${shownDays} ${shownDays === 1 ? 'dia' : 'dias'} do seu acesso grátis`,
          description: "Você já começou a dominar seus números. Mantém o Orbis por R$0,99 por dia (R$29,99/mês) e não perde o ritmo.",
          duration: 8000,
        });
        localStorage.setItem('lastTrialReminder', today);
      }
    }
  }, [user, trialStatus.planStatus, trialStatus.isExpired, trialStatus.daysRemaining, subscriptionStatus.subscribed, subscriptionStatus.status, trialLoading, subscriptionLoading, toast]);

  // Redireciona para troca de senha se o admin gerou uma senha temporária
  useEffect(() => {
    if (!mustChangePassword || !user) return;
    if (location.pathname !== '/force-password-change') {
      navigate('/force-password-change', { replace: true });
    }
  }, [mustChangePassword, user, location.pathname, navigate]);

  useEffect(() => {
    // Redireciona quem não está logado para o login.
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
    // OBS: o bloqueio de teste expirado agora é feito pelo PaywallGate (em router.tsx),
    // que mostra o popup bonito em TODAS as telas (Foco, DEFCON, Dashboard, etc.).
    // Por isso NÃO redirecionamos mais os expirados para /payment aqui.
  }, [user, loading, navigate]);

  // Solta a splash assim que a auth resolve — em QUALQUER rota. Antes o sinal só era
  // disparado pelo Dashboard, então abrir direto em /insights, /defcon etc. prendia a
  // splash pelos 2,5s inteiros (com o app piscando por baixo dela).
  useEffect(() => {
    if (!loading) window.dispatchEvent(new Event("orbis:ready"));
  }, [loading]);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth");
  };

  // GATE DE AUTH: enquanto a sessão não resolve (ou o usuário está deslogado esperando
  // o redirect pro /auth), NÃO monta o app. Antes o dashboard + barra de baixo piscavam
  // por alguns frames pra quem estava deslogado — era um dos flashes do boot.
  // Placeholder de carregamento: logo pulsando no centro em vez de TELA PRETA vazia
  // (a tela preta parecia app travado e era o maior "espaço preto" do boot).
  const bootHolder = (
    <div className="min-h-[100dvh] bg-background grid place-items-center">
      <img src="/orbis-logo.png" alt="" className="w-16 h-16 object-contain opacity-60 animate-pulse" />
    </div>
  );
  if (loading || !user) {
    return bootHolder;
  }

  // Espera a checagem no banco antes de decidir mostrar a missão,
  // pra não piscar o overlay pra quem já é cadastrado.
  if (!onboardingCompleto && user && !onboardingChecked) {
    return bootHolder;
  }
  // Nota: a Missão de Boas-Vindas NÃO substitui mais o app. Ela é renderizada
  // como overlay (MissionOrchestrator) por cima do app real, lá embaixo no JSX.

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
        {!["/", "/my-account", "/settings", "/products", "/rewards", "/benefits", "/competitions", "/x1", "/tributario", "/meu-extrato"].includes(location.pathname) && (
          <div className="mb-2 md:hidden">
            <BackButton to={location.pathname === "/profile" ? "/" : undefined} />
          </div>
        )}
        {/* Trial Warning Banner */}
        {!subscriptionLoading && !(subscriptionStatus.subscribed && subscriptionStatus.status !== "trial") && !trialStatus.isExpired && trialStatus.daysRemaining >= 1 && (
          <div className="mb-6 p-4 rounded-lg bg-warning/10 border-2 border-warning/30 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔥</div>
              <div className="flex-1">
                <h3 className="font-semibold text-warning mb-1">
                  {`Faltam ${Math.min(trialStatus.daysRemaining, 3)} ${Math.min(trialStatus.daysRemaining, 3) === 1 ? 'dia' : 'dias'} do seu acesso grátis`}
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
        {user && !["/meu-extrato", "/defcon"].includes(location.pathname) && (
          <ExtratoReminder userId={user.id} />
        )}
        {user && <WeeklyChallengeTicket />}
        {user && <DesafioFluxoBar />}
        {children}
      </main>

      {/* Mobile bottom navigation — pill flutuante com cápsula deslizante (estilo Strava) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
      >
        <div className="mx-auto max-w-md px-4 pt-1 pointer-events-auto">
          <div className="relative grid grid-cols-5 items-center h-16 px-2 rounded-full border border-border/70 bg-card/90 backdrop-blur-xl shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)]">
            {/* Cápsula do item ativo — desliza com animação suave */}
            {navActiveIndex >= 0 && (
              <div
                className="pointer-events-none absolute top-2 bottom-2 rounded-full bg-primary/12 transition-transform duration-300 ease-out"
                style={{
                  left: '0.5rem',
                  width: 'calc((100% - 1rem) / 5)',
                  transform: `translateX(calc(${navActiveIndex} * 100%))`,
                }}
              />
            )}
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  {...(item.tourId ? { "data-tour": item.tourId } : {})}
                  aria-label={item.name}
                  className="relative z-10 flex flex-col items-center justify-center gap-1 select-none"
                >
                  {item.isCenter ? (
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95",
                        "bg-gradient-to-br from-primary to-[hsl(45_100%_40%)] shadow-[0_2px_8px_-1px_hsl(var(--primary)/0.5)]"
                      )}
                    >
                      <Icon className="h-4 w-4 text-primary-foreground" strokeWidth={2.75} />
                    </div>
                  ) : (
                    <Icon
                      className={cn("h-[22px] w-[22px] transition-colors", isActive ? "text-primary" : "text-muted-foreground")}
                      strokeWidth={2}
                    />
                  )}
                  <span
                    className={cn(
                      "text-[10px] leading-none font-medium transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Floating Chat Button */}
      <FloatingChatButton />

      {/* Missao de Boas-Vindas (onboarding gamificado): overlay sobre o app real */}
      {user && onboardingChecked && !onboardingCompleto && (
        <MissionOrchestrator
          userId={user.id}
          nickname={missionNickname}
          initialIndex={missionStep}
          onCompleted={() => {
            // Liga os tours por tela SÓ pra contas novas (que acabaram de
            // concluir a intro). Quem já usava o app nunca passa por aqui.
            if (typeof window !== "undefined") {
              localStorage.setItem(`orbis_screen_tours_enabled_${user.id}`, "1");
            }
            setOnboardingCompleto(true);
          }}
        />
      )}

      {/* Coach por tela: explica cada tela na 1ª visita (onboarding natural) */}
      {user && onboardingCompleto && <ScreenCoach userId={user.id} isAdmin={isAdmin} />}

      {/* Morning Commit Modal */}
      {user && onboardingCompleto && (
        <MorningCommitModal userId={user.id} onDismiss={() => {}} />
      )}

      {/* LGPD: aceite único dos Termos/Política no primeiro login após a publicação */}
      {user && <AceiteTermosModal userId={user.id} />}

      {/* OBS: o popup de teste expirado agora é renderizado pelo PaywallGate (router.tsx),
          pra aparecer igual em TODAS as telas, inclusive o DEFCON. */}
    </div>
  );
}
