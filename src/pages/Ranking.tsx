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
import confetti from "canvas-confetti";

const motivationalPhrases = [
  "Dominando o jogo com excelência!",
  "Disciplina é o caminho da vitória!",
  "Liderando com propósito!",
  "No topo, onde pertence!",
  "Foco, força e faturamento!",
  "Transformando metas em conquistas!",
];

// Emojis exclusivos para verificar se é emoji ou imagem
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
      <div className={cn(
        "rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg",
        sizeClasses[size],
        className
      )}>
        {avatar}
      </div>
    );
  }
  
  if (avatar) {
    return (
      <img 
        src={avatar} 
        alt={name || ''} 
        className={cn(
          "rounded-full object-cover",
          sizeClasses[size],
          className
        )}
      />
    );
  }
  
  return (
    <div className={cn(
      "rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold text-white",
      sizeClasses[size],
      className
    )}>
      {(name || 'U').charAt(0).toUpperCase()}
    </div>
  );
}

export default function Ranking() {
  const { user } = useAuth();
  const { 
    faturamentoRanking, 
    constanciaRanking, 
    currentUserStats, 
    isLoading,
    hasParticipated,
    loadLeaderboard
  } = useLeaderboard(user?.id);
  
  const [activeTab, setActiveTab] = useState<"faturamento" | "constancia">("faturamento");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Track previous positions for confetti effect
  const prevFaturamentoPosition = useRef<number | null>(null);
  const prevConstanciaPosition = useRef<number | null>(null);

  // Get current user profile for modal
  const [userProfile, setUserProfile] = useState({ nickname: '', avatar: '' });

  const loadUserProfile = async () => {
    if (!user?.id) return;
    const { data } = await (await import("@/integrations/supabase/client")).supabase
      .from("profiles")
      .select("nickname, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setUserProfile({ nickname: data.nickname || '', avatar: data.avatar_url || '' });
    }
  };

  // Trigger confetti when position improves
  useEffect(() => {
    if (!currentUserStats) return;
    
    const currentFaturamentoPos = currentUserStats.posicao_faturamento;
    const currentConstanciaPos = currentUserStats.posicao_constancia;
    
    // Check if faturamento position improved
    if (prevFaturamentoPosition.current !== null && 
        currentFaturamentoPos !== null && 
        currentFaturamentoPos < prevFaturamentoPosition.current) {
      triggerConfetti();
    }
    
    // Check if constancia position improved
    if (prevConstanciaPosition.current !== null && 
        currentConstanciaPos !== null && 
        currentConstanciaPos < prevConstanciaPosition.current) {
      triggerConfetti();
    }
    
    // Update refs
    prevFaturamentoPosition.current = currentFaturamentoPos;
    prevConstanciaPosition.current = currentConstanciaPos;
  }, [currentUserStats?.posicao_faturamento, currentUserStats?.posicao_constancia]);

  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.1, 0.3),
          y: Math.random() - 0.2
        },
        colors: ['#a855f7', '#ec4899', '#f97316', '#fbbf24', '#22c55e']
      });
      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.7, 0.9),
          y: Math.random() - 0.2
        },
        colors: ['#a855f7', '#ec4899', '#f97316', '#fbbf24', '#22c55e']
      });
    }, 250);
  };

  useEffect(() => {
    loadUserProfile();
  }, [user?.id]);

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1:
        return "bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-yellow-600/20 border-yellow-500/50";
      case 2:
        return "bg-gradient-to-br from-slate-400/20 to-slate-500/10 border-slate-400/50";
      case 3:
        return "bg-gradient-to-br from-orange-600/20 to-amber-700/10 border-orange-600/50";
      default:
        return "bg-card/50 border-border/50";
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
            Ranking Orbis
          </h1>
          <p className="text-muted-foreground capitalize">{currentMonth}</p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
          Ranking Orbis
        </h1>
        <p className="text-muted-foreground capitalize">{currentMonth}</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 p-1 bg-card/50 rounded-xl border border-border/50 backdrop-blur-sm">
        <Button
          variant="ghost"
          onClick={() => setActiveTab("faturamento")}
          className={cn(
            "flex-1 gap-2 h-12 rounded-lg transition-all",
            activeTab === "faturamento"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25"
              : "hover:bg-card/80"
          )}
        >
          <Trophy className="w-5 h-5" />
          Faturamento
        </Button>
        <Button
          variant="ghost"
          onClick={() => setActiveTab("constancia")}
          className={cn(
            "flex-1 gap-2 h-12 rounded-lg transition-all",
            activeTab === "constancia"
              ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25"
              : "hover:bg-card/80"
          )}
        >
          <Flame className="w-5 h-5" />
          Constância
        </Button>
      </div>

      {/* Not Participated Message */}
      {!hasParticipated && (
        <Card className="border-2 border-dashed border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="w-12 h-12 mx-auto text-purple-400" />
            <h3 className="text-lg font-semibold">Você ainda não entrou na liga</h3>
            <p className="text-muted-foreground">
              Conclua seu primeiro dia de vendas para aparecer no ranking e competir com outros vendedores!
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === "faturamento" ? (
        <FaturamentoLeague
          ranking={faturamentoRanking}
          currentUserStats={currentUserStats}
          hasParticipated={hasParticipated}
          formatCurrency={formatCurrency}
          getPositionStyle={getPositionStyle}
          onEditProfile={() => {
            loadUserProfile();
            setProfileModalOpen(true);
          }}
          userId={user?.id}
        />
      ) : (
        <ConstanciaLeague
          ranking={constanciaRanking}
          currentUserStats={currentUserStats}
          hasParticipated={hasParticipated}
          getPositionStyle={getPositionStyle}
          onEditProfile={() => {
            loadUserProfile();
            setProfileModalOpen(true);
          }}
          userId={user?.id}
        />
      )}

      {/* Profile Edit Modal */}
      {user && (
        <RankingProfileModal
          open={profileModalOpen}
          onOpenChange={setProfileModalOpen}
          userId={user.id}
          currentNickname={userProfile.nickname}
          currentAvatar={userProfile.avatar}
          onProfileUpdated={() => {
            loadUserProfile();
            loadLeaderboard();
          }}
        />
      )}
    </div>
  );
}

interface FaturamentoLeagueProps {
  ranking: LeaderboardEntry[];
  currentUserStats: LeaderboardEntry | null;
  hasParticipated: boolean;
  formatCurrency: (value: number) => string;
  getPositionStyle: (position: number) => string;
  onEditProfile: () => void;
  userId?: string;
}

function FaturamentoLeague({ 
  ranking, 
  currentUserStats, 
  hasParticipated,
  formatCurrency, 
  getPositionStyle,
  onEditProfile,
  userId
}: FaturamentoLeagueProps) {
  const top1 = ranking[0];
  const top2 = ranking[1];
  const top3 = ranking[2];
  const restRanking = ranking.slice(3, 10);

  // Calculate progress to next position
  const currentPosition = currentUserStats?.posicao_faturamento || 0;
  const currentValue = currentUserStats?.faturamento_total_mes || 0;
  const nextPositionIndex = currentPosition > 1 ? currentPosition - 2 : -1;
  const nextPositionValue = nextPositionIndex >= 0 && ranking[nextPositionIndex] 
    ? ranking[nextPositionIndex].faturamento_total_mes 
    : 0;
  const progressToNext = nextPositionValue > 0 
    ? Math.min((currentValue / nextPositionValue) * 100, 100)
    : 0;

  if (ranking.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border border-yellow-500/30">
            <Trophy className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Liga de Faturamento</h2>
            <p className="text-sm text-muted-foreground">Maiores vendedores do mês</p>
          </div>
        </div>
        
        <Card className="border border-dashed border-border/50 bg-card/30">
          <CardContent className="p-8 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              Nenhum vendedor no ranking ainda. Seja o primeiro a concluir um dia de vendas!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* League Title */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/30 via-amber-500/20 to-yellow-600/30 border border-yellow-500/40 shadow-lg shadow-yellow-500/20">
          <Trophy className="w-7 h-7 text-yellow-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
            Liga de Faturamento
          </h2>
          <p className="text-sm text-muted-foreground">Maiores vendedores do mês</p>
        </div>
      </div>

      {/* Top 1 - ULTRA PREMIUM Card */}
      {top1 && (
        <Card className="relative overflow-hidden border-2 border-yellow-400/60 animate-float">
          {/* Holographic background */}
          <div className="absolute inset-0 holographic-premium opacity-20" />
          
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 via-purple-500/10 to-amber-600/20" />
          
          {/* Shine sweep effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 animate-shine-sweep" />
          </div>
          
          {/* Glow orbs */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-yellow-500/40 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-amber-600/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
          
          <CardContent className="relative p-8">
            {/* Crown and stars header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Crown className="w-12 h-12 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]" />
                  <Sparkles className="w-5 h-5 text-yellow-300 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <div>
                  <span className="text-lg font-black text-yellow-400 tracking-wider drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]">
                    TOP 1
                  </span>
                  <p className="text-xs text-yellow-500/70 uppercase tracking-widest">Campeão do Mês</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className="w-5 h-5 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.6)]" 
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 rounded-full blur-md opacity-60 animate-pulse" />
                {renderAvatar(top1.avatar_url, top1.nome_usuario, "lg", "shadow-2xl shadow-yellow-500/50 border-4 border-yellow-400 relative z-10 w-24 h-24 text-4xl")}
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg z-20 border-2 border-yellow-300">
                  <Crown className="w-5 h-5 text-black" />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-3xl font-black text-foreground drop-shadow-lg">{top1.nome_usuario || 'Usuário'}</h3>
                <p className="text-4xl font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 bg-clip-text text-transparent drop-shadow-lg">
                  {formatCurrency(top1.faturamento_total_mes)}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <p className="text-sm text-purple-300 italic font-medium">
                    "{motivationalPhrases[Math.floor(Math.random() * motivationalPhrases.length)]}"
                  </p>
                </div>
              </div>
            </div>
            
            {/* Achievement badges */}
            <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-yellow-500/20">
              <div className="px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-bold text-yellow-400">LÍDER</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-purple-400">ELITE</span>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold text-amber-400">DESTAQUE</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 2 & 3 - Premium Cards */}
      {(top2 || top3) && (
        <div className="grid grid-cols-2 gap-4">
          {top2 && (
            <Card className="relative overflow-hidden border-2 border-slate-400/60 bg-gradient-to-br from-slate-400/15 via-slate-300/10 to-slate-500/15">
              {/* Subtle shine effect */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 animate-shine-sweep" style={{ animationDuration: '4s' }} />
              </div>
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-slate-400/20 rounded-full blur-2xl" />
              
              <CardContent className="relative p-5 text-center">
                <div className="flex justify-center mb-3">
                  <div className="relative">
                    <Medal className="w-8 h-8 text-slate-300 drop-shadow-[0_0_8px_rgba(148,163,184,0.6)]" />
                    <span className="absolute -top-1 -right-1 text-xs font-black text-slate-400">2</span>
                  </div>
                </div>
                <div className="relative mx-auto mb-3">
                  <div className="absolute -inset-1 bg-gradient-to-r from-slate-400 to-slate-300 rounded-full blur-sm opacity-50" />
                  {renderAvatar(top2.avatar_url, top2.nome_usuario, "md", "border-2 border-slate-300 mx-auto relative z-10 shadow-lg")}
                </div>
                <h4 className="font-bold text-sm truncate text-foreground">{top2.nome_usuario || 'Usuário'}</h4>
                <p className="text-xl font-black bg-gradient-to-r from-slate-300 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  {formatCurrency(top2.faturamento_total_mes)}
                </p>
                <div className="mt-2 px-2 py-1 rounded-full bg-slate-400/20 border border-slate-400/30 inline-flex items-center gap-1">
                  <Star className="w-3 h-3 text-slate-400 fill-slate-400" />
                  <span className="text-xs font-semibold text-slate-400">PRATA</span>
                </div>
              </CardContent>
            </Card>
          )}

          {top3 && (
            <Card className="relative overflow-hidden border-2 border-amber-600/60 bg-gradient-to-br from-amber-700/15 via-orange-600/10 to-amber-800/15">
              {/* Subtle shine effect */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 animate-shine-sweep" style={{ animationDuration: '5s' }} />
              </div>
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-amber-600/20 rounded-full blur-2xl" />
              
              <CardContent className="relative p-5 text-center">
                <div className="flex justify-center mb-3">
                  <div className="relative">
                    <Medal className="w-8 h-8 text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.6)]" />
                    <span className="absolute -top-1 -right-1 text-xs font-black text-amber-600">3</span>
                  </div>
                </div>
                <div className="relative mx-auto mb-3">
                  <div className="absolute -inset-1 bg-gradient-to-r from-amber-600 to-orange-500 rounded-full blur-sm opacity-50" />
                  {renderAvatar(top3.avatar_url, top3.nome_usuario, "md", "border-2 border-amber-500 mx-auto relative z-10 shadow-lg")}
                </div>
                <h4 className="font-bold text-sm truncate text-foreground">{top3.nome_usuario || 'Usuário'}</h4>
                <p className="text-xl font-black bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600 bg-clip-text text-transparent">
                  {formatCurrency(top3.faturamento_total_mes)}
                </p>
                <div className="mt-2 px-2 py-1 rounded-full bg-amber-600/20 border border-amber-600/30 inline-flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-600 fill-amber-600" />
                  <span className="text-xs font-semibold text-amber-600">BRONZE</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Your Position Card */}
      {hasParticipated && currentUserStats && (
        <Card className="border-2 border-purple-500/50 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                {renderAvatar(currentUserStats.avatar_url, currentUserStats.nome_usuario, "sm", "border border-purple-500")}
                <button
                  onClick={onEditProfile}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center shadow-lg hover:bg-purple-600 transition-colors"
                >
                  <Edit2 className="w-3 h-3 text-white" />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                    VOCÊ
                  </span>
                  <span className="text-muted-foreground">#{currentUserStats.posicao_faturamento}</span>
                </div>
                <p className="text-xl font-bold">{formatCurrency(currentUserStats.faturamento_total_mes)}</p>
              </div>
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            
            {currentPosition > 1 && nextPositionValue > currentValue && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Para #{currentPosition - 1}</span>
                  <span className="text-purple-400 font-medium">
                    Faltam {formatCurrency(nextPositionValue - currentValue)}
                  </span>
                </div>
                <Progress value={progressToNext} className="h-2 bg-purple-950" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rest of Top 10 - Premium List */}
      {restRanking.length > 0 && (
        <div className="space-y-2">
          {restRanking.map((user, index) => (
            <Card 
              key={user.id} 
              className="group relative overflow-hidden border border-purple-500/20 bg-gradient-to-r from-card/80 via-purple-500/5 to-card/80 hover:from-purple-500/10 hover:via-purple-500/15 hover:to-purple-500/10 transition-all duration-300 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="relative p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                  <span className="text-sm font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {index + 4}
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                  {renderAvatar(user.avatar_url, user.nome_usuario, "sm", "relative z-10 border border-purple-500/30")}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground group-hover:text-purple-300 transition-colors">{user.nome_usuario || 'Usuário'}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <TrendingUp className="w-3 h-3 text-purple-400" />
                    <span className="text-xs text-muted-foreground">Top 10</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-purple-400 group-hover:text-purple-300 transition-colors">{formatCurrency(user.faturamento_total_mes)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {ranking.length > 10 && (
        <Button variant="outline" className="w-full gap-2 h-12 border-border/50">
          Ver ranking completo
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

interface ConstanciaLeagueProps {
  ranking: LeaderboardEntry[];
  currentUserStats: LeaderboardEntry | null;
  hasParticipated: boolean;
  getPositionStyle: (position: number) => string;
  onEditProfile: () => void;
  userId?: string;
}

function ConstanciaLeague({ 
  ranking, 
  currentUserStats, 
  hasParticipated,
  getPositionStyle,
  onEditProfile,
  userId
}: ConstanciaLeagueProps) {
  const top1 = ranking[0];
  const top2 = ranking[1];
  const top3 = ranking[2];
  const restRanking = ranking.slice(3, 10);

  // Calculate progress to next position
  const currentPosition = currentUserStats?.posicao_constancia || 0;
  const currentDays = currentUserStats?.dias_trabalhados_mes || 0;
  const nextPositionIndex = currentPosition > 1 ? currentPosition - 2 : -1;
  const nextPositionDays = nextPositionIndex >= 0 && ranking[nextPositionIndex] 
    ? ranking[nextPositionIndex].dias_trabalhados_mes 
    : 0;
  const progressToNext = nextPositionDays > 0 
    ? Math.min((currentDays / nextPositionDays) * 100, 100)
    : 0;

  if (ranking.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-600/10 border border-orange-500/30">
            <Flame className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Liga de Constância</h2>
            <p className="text-sm text-muted-foreground">Mais disciplinados do mês</p>
          </div>
        </div>
        
        <Card className="border border-dashed border-border/50 bg-card/30">
          <CardContent className="p-8 text-center">
            <Flame className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              Nenhum vendedor no ranking ainda. Seja o primeiro a concluir um dia de vendas!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* League Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-600/10 border border-orange-500/30">
          <Flame className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Liga de Constância</h2>
          <p className="text-sm text-muted-foreground">Mais disciplinados do mês</p>
        </div>
      </div>

      {/* Top 1 - Premium Card */}
      {top1 && (
        <Card className="relative overflow-hidden border-2 border-orange-500/50 bg-gradient-to-br from-orange-500/10 via-red-500/5 to-yellow-500/10">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-red-500/5 animate-pulse" />
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-red-500/20 rounded-full blur-3xl" />
          
          <CardContent className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-8 h-8 text-orange-500 animate-pulse" />
                <span className="text-sm font-medium text-orange-500">TOP 1</span>
              </div>
              <div className="flex items-center gap-1 text-orange-500">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-bold">{top1.constancia_streak_atual} dias seguidos</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                {renderAvatar(top1.avatar_url, top1.nome_usuario, "lg", "shadow-xl shadow-orange-500/30 border-2 border-orange-500")}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                  <Flame className="w-4 h-4 text-black" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-foreground">{top1.nome_usuario || 'Usuário'}</h3>
                <p className="text-3xl font-black bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                  {top1.dias_trabalhados_mes} dias trabalhados
                </p>
                <p className="text-sm text-muted-foreground italic mt-1">
                  "Disciplina é o caminho da vitória!"
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 2 & 3 - Premium Cards */}
      {(top2 || top3) && (
        <div className="grid grid-cols-2 gap-4">
          {top2 && (
            <Card className="relative overflow-hidden border-2 border-slate-400/60 bg-gradient-to-br from-slate-400/15 via-slate-300/10 to-slate-500/15">
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 animate-shine-sweep" style={{ animationDuration: '4s' }} />
              </div>
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-slate-400/20 rounded-full blur-2xl" />
              
              <CardContent className="relative p-5 text-center">
                <div className="flex justify-center mb-3">
                  <div className="relative">
                    <Medal className="w-8 h-8 text-slate-300 drop-shadow-[0_0_8px_rgba(148,163,184,0.6)]" />
                    <span className="absolute -top-1 -right-1 text-xs font-black text-slate-400">2</span>
                  </div>
                </div>
                <div className="relative mx-auto mb-3">
                  <div className="absolute -inset-1 bg-gradient-to-r from-slate-400 to-slate-300 rounded-full blur-sm opacity-50" />
                  {renderAvatar(top2.avatar_url, top2.nome_usuario, "md", "border-2 border-slate-300 mx-auto relative z-10 shadow-lg")}
                </div>
                <h4 className="font-bold text-sm truncate text-foreground">{top2.nome_usuario || 'Usuário'}</h4>
                <p className="text-xl font-black bg-gradient-to-r from-slate-300 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  {top2.dias_trabalhados_mes} dias
                </p>
                <p className="text-xs text-muted-foreground mt-1">{top2.constancia_streak_atual} seguidos</p>
                <div className="mt-2 px-2 py-1 rounded-full bg-slate-400/20 border border-slate-400/30 inline-flex items-center gap-1">
                  <Flame className="w-3 h-3 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-400">PRATA</span>
                </div>
              </CardContent>
            </Card>
          )}

          {top3 && (
            <Card className="relative overflow-hidden border-2 border-amber-600/60 bg-gradient-to-br from-amber-700/15 via-orange-600/10 to-amber-800/15">
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 animate-shine-sweep" style={{ animationDuration: '5s' }} />
              </div>
              <div className="absolute -top-16 -right-16 w-32 h-32 bg-amber-600/20 rounded-full blur-2xl" />
              
              <CardContent className="relative p-5 text-center">
                <div className="flex justify-center mb-3">
                  <div className="relative">
                    <Medal className="w-8 h-8 text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.6)]" />
                    <span className="absolute -top-1 -right-1 text-xs font-black text-amber-600">3</span>
                  </div>
                </div>
                <div className="relative mx-auto mb-3">
                  <div className="absolute -inset-1 bg-gradient-to-r from-amber-600 to-orange-500 rounded-full blur-sm opacity-50" />
                  {renderAvatar(top3.avatar_url, top3.nome_usuario, "md", "border-2 border-amber-500 mx-auto relative z-10 shadow-lg")}
                </div>
                <h4 className="font-bold text-sm truncate text-foreground">{top3.nome_usuario || 'Usuário'}</h4>
                <p className="text-xl font-black bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600 bg-clip-text text-transparent">
                  {top3.dias_trabalhados_mes} dias
                </p>
                <p className="text-xs text-muted-foreground mt-1">{top3.constancia_streak_atual} seguidos</p>
                <div className="mt-2 px-2 py-1 rounded-full bg-amber-600/20 border border-amber-600/30 inline-flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-600">BRONZE</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Your Position Card */}
      {hasParticipated && currentUserStats && (
        <Card className="border-2 border-orange-500/50 bg-gradient-to-r from-orange-500/10 to-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                {renderAvatar(currentUserStats.avatar_url, currentUserStats.nome_usuario, "sm", "border border-orange-500")}
                <button
                  onClick={onEditProfile}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shadow-lg hover:bg-orange-600 transition-colors"
                >
                  <Edit2 className="w-3 h-3 text-white" />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">
                    VOCÊ
                  </span>
                  <span className="text-muted-foreground">#{currentUserStats.posicao_constancia}</span>
                </div>
                <p className="text-xl font-bold">{currentUserStats.dias_trabalhados_mes} dias trabalhados</p>
                <p className="text-sm text-muted-foreground">{currentUserStats.constancia_streak_atual} dias seguidos</p>
              </div>
              <Flame className="w-6 h-6 text-orange-400" />
            </div>
            
            {currentPosition > 1 && nextPositionDays > currentDays && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Para #{currentPosition - 1}</span>
                  <span className="text-orange-400 font-medium">
                    Faltam {nextPositionDays - currentDays} dias
                  </span>
                </div>
                <Progress value={progressToNext} className="h-2 bg-orange-950" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rest of Top 10 - Premium List */}
      {restRanking.length > 0 && (
        <div className="space-y-2">
          {restRanking.map((user, index) => (
            <Card 
              key={user.id} 
              className="group relative overflow-hidden border border-orange-500/20 bg-gradient-to-r from-card/80 via-orange-500/5 to-card/80 hover:from-orange-500/10 hover:via-orange-500/15 hover:to-orange-500/10 transition-all duration-300 hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="relative p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 flex items-center justify-center">
                  <span className="text-sm font-black bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                    {index + 4}
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/30 to-red-500/30 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
                  {renderAvatar(user.avatar_url, user.nome_usuario, "sm", "relative z-10 border border-orange-500/30")}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground group-hover:text-orange-300 transition-colors">{user.nome_usuario || 'Usuário'}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span className="text-xs text-muted-foreground">{user.constancia_streak_atual} seguidos</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-orange-400 group-hover:text-orange-300 transition-colors">{user.dias_trabalhados_mes} dias</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {ranking.length > 10 && (
        <Button variant="outline" className="w-full gap-2 h-12 border-border/50">
          Ver ranking completo
          <ChevronRight className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
