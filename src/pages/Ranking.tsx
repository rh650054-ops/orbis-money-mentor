import { useState, useEffect, useRef } from "react";
import { Trophy, Crown, Medal, Flame, TrendingUp, ChevronRight, Star, Zap, AlertCircle, Edit2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard, LeaderboardEntry } from "@/hooks/useLeaderboard";
import { Skeleton } from "@/components/ui/skeleton";
import { RankingProfileModal } from "@/components/RankingProfileModal";
import PublicProfileModal from "@/components/PublicProfileModal";
import confetti from "canvas-confetti";

const motivationalPhrases = [
  "Dominando o jogo com excelência!",
  "Disciplina é o caminho da vitória!",
  "Liderando com propósito!",
  "No topo, onde pertence!",
  "Foco, força e faturamento!",
  "Transformando metas em conquistas!",
];

const EXCLUSIVE_EMOJIS = ["🦁", "🐺", "🦅", "🔥", "⚡", "💎", "🚀", "👑", "🎯", "💪", "🏆", "⭐", "🐉", "🦈", "🐯", "🦊"];

function isEmojiAvatar(avatar: string | null): boolean {
  if (!avatar) return false;
  return EXCLUSIVE_EMOJIS.includes(avatar);
}

function renderAvatar(avatar: string | null, name: string | null, size: "sm" | "md" | "lg" = "md", className?: string) {
  const sizeClasses = {
    sm: "w-10 h-10 text-lg",
    md: "w-14 h-14 text-xl",
    lg: "w-20 h-20 text-3xl"
  };
  if (isEmojiAvatar(avatar)) {
    return (
      <div className={cn("rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center shadow-lg", sizeClasses[size], className)}>
        {avatar}
      </div>
    );
  }
  if (avatar) {
    return <img src={avatar} alt={name || ''} className={cn("rounded-full object-cover", sizeClasses[size], className)} />;
  }
  return (
    <div className={cn("rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border border-primary/30 flex items-center justify-center font-bold text-primary", sizeClasses[size], className)}>
      {(name || 'U').charAt(0).toUpperCase()}
    </div>
  );
}

export default function Ranking() {
  const { user } = useAuth();
  const {
    faturamentoRanking, constanciaRanking, currentUserStats,
    isLoading, hasParticipated, loadLeaderboard
  } = useLeaderboard(user?.id);

  const [activeTab, setActiveTab] = useState<"faturamento" | "constancia">("faturamento");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null);
  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const prevFaturamentoPosition = useRef<number | null>(null);
  const prevConstanciaPosition = useRef<number | null>(null);

  const [userProfile, setUserProfile] = useState({ nickname: '', avatar: '' });

  const loadUserProfile = async () => {
    if (!user?.id) return;
    const { data } = await (await import("@/integrations/supabase/client")).supabase
      .from("profiles")
      .select("nickname, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setUserProfile({ nickname: data.nickname || '', avatar: data.avatar_url || '' });
  };

  useEffect(() => {
    if (!currentUserStats) return;
    const cf = currentUserStats.posicao_faturamento;
    const cc = currentUserStats.posicao_constancia;
    if (prevFaturamentoPosition.current !== null && cf !== null && cf < prevFaturamentoPosition.current) triggerConfetti();
    if (prevConstanciaPosition.current !== null && cc !== null && cc < prevConstanciaPosition.current) triggerConfetti();
    prevFaturamentoPosition.current = cf;
    prevConstanciaPosition.current = cc;
  }, [currentUserStats?.posicao_faturamento, currentUserStats?.posicao_constancia]);

  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const r = (min: number, max: number) => Math.random() * (max - min) + min;
    const interval = setInterval(() => {
      const left = animationEnd - Date.now();
      if (left <= 0) return clearInterval(interval);
      const particleCount = 50 * (left / duration);
      const colors = ['#F4A100', '#FFD27A', '#FFFFFF', '#C77E00'];
      confetti({ particleCount, startVelocity: 30, spread: 360, origin: { x: r(0.1, 0.3), y: Math.random() - 0.2 }, colors });
      confetti({ particleCount, startVelocity: 30, spread: 360, origin: { x: r(0.7, 0.9), y: Math.random() - 0.2 }, colors });
    }, 250);
  };

  useEffect(() => { loadUserProfile(); }, [user?.id]);

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const openPublicProfile = (uid: string) => {
    if (!uid) return;
    setPublicProfileUserId(uid);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Ranking <span className="text-primary">Orbis</span>
          </h1>
          <p className="text-muted-foreground capitalize text-sm">{currentMonth}</p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const isFaturamento = activeTab === "faturamento";

  return (
    <div className="min-h-screen pb-8 space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Ranking <span className="text-primary">Orbis</span>
        </h1>
        <p className="text-muted-foreground capitalize text-sm">{currentMonth}</p>
      </div>

      {/* Unified League Tabs — botão = liga inteira (não há mais título separado) */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => setActiveTab("faturamento")}
          className={cn(
            "relative overflow-hidden rounded-xl p-3.5 text-left transition-all duration-300",
            "border",
            isFaturamento
              ? "bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/50 shadow-lg shadow-primary/20"
              : "bg-card/40 border-border/50 hover:border-primary/30"
          )}
        >
          {isFaturamento && (
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
          )}
          <div className="relative flex items-center gap-2.5">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
              isFaturamento ? "bg-primary text-primary-foreground" : "bg-card border border-border/50 text-muted-foreground"
            )}>
              <Trophy className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className={cn("text-[9px] font-bold uppercase tracking-widest", isFaturamento ? "text-primary" : "text-muted-foreground")}>
                Liga
              </p>
              <p className={cn("text-sm font-black truncate", isFaturamento ? "text-foreground" : "text-foreground/70")}>
                Faturamento
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("constancia")}
          className={cn(
            "relative overflow-hidden rounded-xl p-3.5 text-left transition-all duration-300",
            "border",
            !isFaturamento
              ? "bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/50 shadow-lg shadow-primary/20"
              : "bg-card/40 border-border/50 hover:border-primary/30"
          )}
        >
          {!isFaturamento && (
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
          )}
          <div className="relative flex items-center gap-2.5">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
              !isFaturamento ? "bg-primary text-primary-foreground" : "bg-card border border-border/50 text-muted-foreground"
            )}>
              <Flame className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className={cn("text-[9px] font-bold uppercase tracking-widest", !isFaturamento ? "text-primary" : "text-muted-foreground")}>
                Liga
              </p>
              <p className={cn("text-sm font-black truncate", !isFaturamento ? "text-foreground" : "text-foreground/70")}>
                Constância
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Subtítulo da liga ativa */}
      <p className="text-center text-xs text-muted-foreground -mt-2">
        {isFaturamento ? "Maiores vendedores do mês" : "Os mais disciplinados do mês"}
      </p>

      {/* Not Participated Message */}
      {!hasParticipated && (
        <Card className="border border-dashed border-primary/30 bg-card/50">
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="w-10 h-10 mx-auto text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Você ainda não entrou na liga</h3>
            <p className="text-muted-foreground text-sm">
              Conclua seu primeiro dia de vendas para aparecer no ranking!
            </p>
          </CardContent>
        </Card>
      )}

      {isFaturamento ? (
        <FaturamentoLeague
          ranking={faturamentoRanking}
          currentUserStats={currentUserStats}
          hasParticipated={hasParticipated}
          formatCurrency={formatCurrency}
          onEditProfile={() => { loadUserProfile(); setProfileModalOpen(true); }}
          onOpenProfile={openPublicProfile}
        />
      ) : (
        <ConstanciaLeague
          ranking={constanciaRanking}
          currentUserStats={currentUserStats}
          hasParticipated={hasParticipated}
          onEditProfile={() => { loadUserProfile(); setProfileModalOpen(true); }}
          onOpenProfile={openPublicProfile}
        />
      )}

      {user && (
        <RankingProfileModal
          open={profileModalOpen}
          onOpenChange={setProfileModalOpen}
          userId={user.id}
          currentNickname={userProfile.nickname}
          currentAvatar={userProfile.avatar}
          onProfileUpdated={() => { loadUserProfile(); loadLeaderboard(); }}
        />
      )}

      <PublicProfileModal
        open={!!publicProfileUserId}
        onOpenChange={(o) => { if (!o) setPublicProfileUserId(null); }}
        userId={publicProfileUserId}
      />
    </div>
  );
}

interface LeagueProps {
  ranking: LeaderboardEntry[];
  currentUserStats: LeaderboardEntry | null;
  hasParticipated: boolean;
  onEditProfile: () => void;
  onOpenProfile: (uid: string) => void;
}

interface FaturamentoLeagueProps extends LeagueProps {
  formatCurrency: (value: number) => string;
}

function FaturamentoLeague({ ranking, currentUserStats, hasParticipated, formatCurrency, onEditProfile, onOpenProfile }: FaturamentoLeagueProps) {
  const top1 = ranking[0];
  const top2 = ranking[1];
  const top3 = ranking[2];
  const restRanking = ranking.slice(3, 10);

  const currentPosition = currentUserStats?.posicao_faturamento || 0;
  const currentValue = currentUserStats?.faturamento_total_mes || 0;
  const nextPositionIndex = currentPosition > 1 ? currentPosition - 2 : -1;
  const nextPositionValue = nextPositionIndex >= 0 && ranking[nextPositionIndex]
    ? ranking[nextPositionIndex].faturamento_total_mes : 0;
  const progressToNext = nextPositionValue > 0 ? Math.min((currentValue / nextPositionValue) * 100, 100) : 0;

  if (ranking.length === 0) {
    return (
      <Card className="border border-dashed border-border/50 bg-card/30">
        <CardContent className="p-8 text-center">
          <Trophy className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">
            Nenhum vendedor ainda. Seja o primeiro!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 1 */}
      {top1 && (
        <Card className="relative overflow-hidden border border-primary/40 bg-card">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-primary/10 to-transparent skew-x-12 animate-shine-sweep" />
          </div>

          <CardContent className="relative p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Crown className="w-9 h-9 text-primary drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" />
                  <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div>
                  <span className="text-base font-black text-primary tracking-wider">TOP 1</span>
                  <p className="text-[10px] text-primary/70 uppercase tracking-widest">Campeão do Mês</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-primary fill-primary" />)}
              </div>
            </div>

            <div className="flex items-center gap-5">
              <button onClick={() => onOpenProfile(top1.user_id)} className="relative shrink-0 transition-transform active:scale-95">
                <div className="absolute -inset-1.5 bg-primary rounded-full blur-md opacity-50 animate-pulse" />
                {renderAvatar(top1.avatar_url, top1.nome_usuario, "lg", "shadow-2xl shadow-primary/40 border-2 border-primary relative z-10 w-20 h-20 text-3xl")}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg z-20 border-2 border-background">
                  <Crown className="w-4 h-4 text-primary-foreground" />
                </div>
              </button>
              <button onClick={() => onOpenProfile(top1.user_id)} className="flex-1 min-w-0 space-y-1 text-left">
                <h3 className="text-xl font-bold text-foreground truncate hover:text-primary transition-colors">{top1.nome_usuario || 'Usuário'}</h3>
                <p className="text-2xl font-black text-primary">{formatCurrency(top1.faturamento_total_mes)}</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <Sparkles className="w-3 h-3 text-primary/70 shrink-0" />
                  <p className="text-[11px] text-muted-foreground italic truncate">"{motivationalPhrases[0]}"</p>
                </div>
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 mt-5 pt-4 border-t border-primary/15">
              <div className="px-2.5 py-1 rounded-full bg-primary border border-primary flex items-center gap-1.5">
                <Trophy className="w-3 h-3 text-primary-foreground" />
                <span className="text-[10px] font-bold text-primary-foreground tracking-wide">LÍDER</span>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-foreground/10 border border-foreground/30 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-foreground" />
                <span className="text-[10px] font-bold text-foreground tracking-wide">ELITE</span>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-background border border-foreground/20 flex items-center gap-1.5">
                <Star className="w-3 h-3 text-foreground fill-foreground" />
                <span className="text-[10px] font-bold text-foreground tracking-wide">DESTAQUE</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 2 & 3 */}
      {(top2 || top3) && (
        <div className="grid grid-cols-2 gap-3">
          {top2 && (
            <button onClick={() => onOpenProfile(top2.user_id)} className="text-left">
              <Card className="relative overflow-hidden border border-foreground/20 bg-card hover:border-foreground/40 transition-colors">
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-foreground/10 rounded-full blur-2xl" />
                <CardContent className="relative p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="relative">
                      <Medal className="w-7 h-7 text-foreground/70" />
                      <span className="absolute -top-1 -right-1 text-[10px] font-black text-foreground/70">2</span>
                    </div>
                  </div>
                  <div className="relative mx-auto mb-2 w-fit">
                    {renderAvatar(top2.avatar_url, top2.nome_usuario, "md", "border border-foreground/30 mx-auto shadow-md")}
                  </div>
                  <h4 className="font-bold text-xs truncate text-foreground">{top2.nome_usuario || 'Usuário'}</h4>
                  <p className="text-base font-black text-foreground mt-0.5">{formatCurrency(top2.faturamento_total_mes)}</p>
                  <div className="mt-2 px-2 py-0.5 rounded-full bg-foreground/10 border border-foreground/20 inline-flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 text-foreground/70 fill-foreground/70" />
                    <span className="text-[9px] font-semibold text-foreground/70 tracking-wider">PRATA</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          )}

          {top3 && (
            <button onClick={() => onOpenProfile(top3.user_id)} className="text-left">
              <Card className="relative overflow-hidden border border-[#a8703a]/50 bg-card hover:border-[#a8703a]/70 transition-colors">
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#a8703a]/15 rounded-full blur-2xl" />
                <CardContent className="relative p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="relative">
                      <Medal className="w-7 h-7 text-[#a8703a]" />
                      <span className="absolute -top-1 -right-1 text-[10px] font-black text-[#a8703a]">3</span>
                    </div>
                  </div>
                  <div className="relative mx-auto mb-2 w-fit">
                    {renderAvatar(top3.avatar_url, top3.nome_usuario, "md", "border border-[#a8703a]/60 mx-auto shadow-md")}
                  </div>
                  <h4 className="font-bold text-xs truncate text-foreground">{top3.nome_usuario || 'Usuário'}</h4>
                  <p className="text-base font-black text-foreground mt-0.5">{formatCurrency(top3.faturamento_total_mes)}</p>
                  <div className="mt-2 px-2 py-0.5 rounded-full bg-[#a8703a]/15 border border-[#a8703a]/40 inline-flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 text-[#a8703a] fill-[#a8703a]" />
                    <span className="text-[9px] font-semibold text-[#a8703a] tracking-wider">BRONZE</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          )}
        </div>
      )}

      {/* Your Position */}
      {hasParticipated && currentUserStats && (
        <Card className="border border-primary/40 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                {renderAvatar(currentUserStats.avatar_url, currentUserStats.nome_usuario, "sm", "border border-primary/50")}
                <button
                  onClick={onEditProfile}
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
                >
                  <Edit2 className="w-2.5 h-2.5 text-primary-foreground" />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold tracking-wider">VOCÊ</span>
                  <span className="text-muted-foreground text-sm">#{currentUserStats.posicao_faturamento}</span>
                </div>
                <p className="text-lg font-bold text-foreground">{formatCurrency(currentUserStats.faturamento_total_mes)}</p>
              </div>
              <Zap className="w-5 h-5 text-primary" />
            </div>
            {currentPosition > 1 && nextPositionValue > currentValue && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Para #{currentPosition - 1}</span>
                  <span className="text-primary font-medium">Faltam {formatCurrency(nextPositionValue - currentValue)}</span>
                </div>
                <Progress value={progressToNext} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rest of Top 10 */}
      {restRanking.length > 0 && (
        <div className="space-y-2">
          {restRanking.map((u, index) => (
            <button key={u.id} onClick={() => onOpenProfile(u.user_id)} className="w-full text-left">
              <Card className="group relative overflow-hidden border border-border/50 bg-card hover:border-primary/40 transition-all duration-300">
                <CardContent className="relative p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-foreground/5 border border-foreground/15 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-foreground/80">{index + 4}</span>
                  </div>
                  {renderAvatar(u.avatar_url, u.nome_usuario, "sm", "border border-border/50")}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{u.nome_usuario || 'Usuário'}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <TrendingUp className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Top 10</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground text-sm">{formatCurrency(u.faturamento_total_mes)}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {ranking.length > 10 && (
        <Button variant="outline" className="w-full gap-2 h-11 border-border/50 text-muted-foreground">
          Ver ranking completo
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

function ConstanciaLeague({ ranking, currentUserStats, hasParticipated, onEditProfile, onOpenProfile }: LeagueProps) {
  const top1 = ranking[0];
  const top2 = ranking[1];
  const top3 = ranking[2];
  const restRanking = ranking.slice(3, 10);

  const currentPosition = currentUserStats?.posicao_constancia || 0;
  const currentDays = currentUserStats?.dias_trabalhados_mes || 0;
  const nextPositionIndex = currentPosition > 1 ? currentPosition - 2 : -1;
  const nextPositionDays = nextPositionIndex >= 0 && ranking[nextPositionIndex]
    ? ranking[nextPositionIndex].dias_trabalhados_mes : 0;
  const progressToNext = nextPositionDays > 0 ? Math.min((currentDays / nextPositionDays) * 100, 100) : 0;

  if (ranking.length === 0) {
    return (
      <Card className="border border-dashed border-border/50 bg-card/30">
        <CardContent className="p-8 text-center">
          <Flame className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Nenhum vendedor ainda. Seja o primeiro!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 1 */}
      {top1 && (
        <Card className="relative overflow-hidden border border-primary/40 bg-card">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

          <CardContent className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-7 h-7 text-primary animate-pulse drop-shadow-[0_0_10px_hsl(var(--primary)/0.6)]" />
                <span className="text-sm font-black text-primary tracking-wider">TOP 1</span>
              </div>
              <div className="flex items-center gap-1 text-primary">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-bold">{top1.constancia_streak_atual} dias seguidos</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={() => onOpenProfile(top1.user_id)} className="relative shrink-0 active:scale-95 transition-transform">
                <div className="absolute -inset-1.5 bg-primary rounded-full blur-md opacity-40 animate-pulse" />
                {renderAvatar(top1.avatar_url, top1.nome_usuario, "lg", "shadow-2xl shadow-primary/40 border-2 border-primary relative z-10")}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-background z-20">
                  <Flame className="w-4 h-4 text-primary-foreground" />
                </div>
              </button>
              <button onClick={() => onOpenProfile(top1.user_id)} className="flex-1 min-w-0 text-left">
                <h3 className="text-xl font-bold text-foreground truncate hover:text-primary transition-colors">{top1.nome_usuario || 'Usuário'}</h3>
                <p className="text-2xl font-black text-primary">{top1.dias_trabalhados_mes} dias</p>
                <p className="text-[11px] text-muted-foreground italic mt-0.5">"Disciplina é o caminho da vitória!"</p>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 2 & 3 */}
      {(top2 || top3) && (
        <div className="grid grid-cols-2 gap-3">
          {top2 && (
            <button onClick={() => onOpenProfile(top2.user_id)} className="text-left">
              <Card className="relative overflow-hidden border border-foreground/20 bg-card hover:border-foreground/40 transition-colors">
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-foreground/10 rounded-full blur-2xl" />
                <CardContent className="relative p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="relative">
                      <Medal className="w-7 h-7 text-foreground/70" />
                      <span className="absolute -top-1 -right-1 text-[10px] font-black text-foreground/70">2</span>
                    </div>
                  </div>
                  <div className="relative mx-auto mb-2 w-fit">
                    {renderAvatar(top2.avatar_url, top2.nome_usuario, "md", "border border-foreground/30 mx-auto shadow-md")}
                  </div>
                  <h4 className="font-bold text-xs truncate text-foreground">{top2.nome_usuario || 'Usuário'}</h4>
                  <p className="text-base font-black text-foreground mt-0.5">{top2.dias_trabalhados_mes} dias</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{top2.constancia_streak_atual} seguidos</p>
                  <div className="mt-2 px-2 py-0.5 rounded-full bg-foreground/10 border border-foreground/20 inline-flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-foreground/70" />
                    <span className="text-[9px] font-semibold text-foreground/70 tracking-wider">PRATA</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          )}

          {top3 && (
            <button onClick={() => onOpenProfile(top3.user_id)} className="text-left">
              <Card className="relative overflow-hidden border border-[#a8703a]/50 bg-card hover:border-[#a8703a]/70 transition-colors">
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#a8703a]/15 rounded-full blur-2xl" />
                <CardContent className="relative p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="relative">
                      <Medal className="w-7 h-7 text-[#a8703a]" />
                      <span className="absolute -top-1 -right-1 text-[10px] font-black text-[#a8703a]">3</span>
                    </div>
                  </div>
                  <div className="relative mx-auto mb-2 w-fit">
                    {renderAvatar(top3.avatar_url, top3.nome_usuario, "md", "border border-[#a8703a]/60 mx-auto shadow-md")}
                  </div>
                  <h4 className="font-bold text-xs truncate text-foreground">{top3.nome_usuario || 'Usuário'}</h4>
                  <p className="text-base font-black text-foreground mt-0.5">{top3.dias_trabalhados_mes} dias</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{top3.constancia_streak_atual} seguidos</p>
                  <div className="mt-2 px-2 py-0.5 rounded-full bg-[#a8703a]/15 border border-[#a8703a]/40 inline-flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-[#a8703a]" />
                    <span className="text-[9px] font-semibold text-[#a8703a] tracking-wider">BRONZE</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          )}
        </div>
      )}

      {/* Your Position */}
      {hasParticipated && currentUserStats && (
        <Card className="border border-primary/40 bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                {renderAvatar(currentUserStats.avatar_url, currentUserStats.nome_usuario, "sm", "border border-primary/50")}
                <button
                  onClick={onEditProfile}
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
                >
                  <Edit2 className="w-2.5 h-2.5 text-primary-foreground" />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold tracking-wider">VOCÊ</span>
                  <span className="text-muted-foreground text-sm">#{currentUserStats.posicao_constancia}</span>
                </div>
                <p className="text-lg font-bold text-foreground">{currentUserStats.dias_trabalhados_mes} dias trabalhados</p>
                <p className="text-xs text-muted-foreground">{currentUserStats.constancia_streak_atual} dias seguidos</p>
              </div>
              <Flame className="w-5 h-5 text-primary" />
            </div>
            {currentPosition > 1 && nextPositionDays > currentDays && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Para #{currentPosition - 1}</span>
                  <span className="text-primary font-medium">Faltam {nextPositionDays - currentDays} dias</span>
                </div>
                <Progress value={progressToNext} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rest of Top 10 */}
      {restRanking.length > 0 && (
        <div className="space-y-2">
          {restRanking.map((u, index) => (
            <button key={u.id} onClick={() => onOpenProfile(u.user_id)} className="w-full text-left">
              <Card className="group relative overflow-hidden border border-border/50 bg-card hover:border-primary/40 transition-all duration-300">
                <CardContent className="relative p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-foreground/5 border border-foreground/15 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-foreground/80">{index + 4}</span>
                  </div>
                  {renderAvatar(u.avatar_url, u.nome_usuario, "sm", "border border-border/50")}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{u.nome_usuario || 'Usuário'}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Flame className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{u.constancia_streak_atual} seguidos</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground text-sm">{u.dias_trabalhados_mes} dias</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {ranking.length > 10 && (
        <Button variant="outline" className="w-full gap-2 h-11 border-border/50 text-muted-foreground">
          Ver ranking completo
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
