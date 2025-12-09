import { useState, useEffect } from "react";
import { Trophy, Crown, Medal, Flame, TrendingUp, ChevronRight, Star, Zap, AlertCircle, Edit2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard, LeaderboardEntry } from "@/hooks/useLeaderboard";
import { Skeleton } from "@/components/ui/skeleton";
import { RankingProfileModal } from "@/components/RankingProfileModal";
const motivationalPhrases = [
  "Dominando o jogo com excelência!",
  "Disciplina é o caminho da vitória!",
  "Liderando com propósito!",
  "No topo, onde pertence!",
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
        <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border border-yellow-500/30">
          <Trophy className="w-6 h-6 text-yellow-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Liga de Faturamento</h2>
          <p className="text-sm text-muted-foreground">Maiores vendedores do mês</p>
        </div>
      </div>

      {/* Top 1 - Premium Card */}
      {top1 && (
        <Card className="relative overflow-hidden border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 via-purple-500/5 to-pink-500/10">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-purple-500/5 animate-pulse" />
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
          
          <CardContent className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className="w-8 h-8 text-yellow-500 animate-pulse" />
                <span className="text-sm font-medium text-yellow-500">TOP 1</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                {renderAvatar(top1.avatar_url, top1.nome_usuario, "lg", "shadow-xl shadow-yellow-500/30 border-2 border-yellow-500")}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg">
                  <Crown className="w-4 h-4 text-black" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-foreground">{top1.nome_usuario || 'Usuário'}</h3>
                <p className="text-3xl font-black bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
                  {formatCurrency(top1.faturamento_total_mes)}
                </p>
                <p className="text-sm text-muted-foreground italic mt-1">
                  "{motivationalPhrases[0]}"
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 2 & 3 */}
      {(top2 || top3) && (
        <div className="grid grid-cols-2 gap-3">
          {top2 && (
            <Card className={cn("border", getPositionStyle(2))}>
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-2">
                  <Medal className="w-6 h-6 text-slate-400" />
                </div>
                <div className="mx-auto mb-2">
                  {renderAvatar(top2.avatar_url, top2.nome_usuario, "md", "border border-slate-400 mx-auto")}
                </div>
                <h4 className="font-semibold text-sm truncate">{top2.nome_usuario || 'Usuário'}</h4>
                <p className="text-lg font-bold text-slate-400">{formatCurrency(top2.faturamento_total_mes)}</p>
              </CardContent>
            </Card>
          )}

          {top3 && (
            <Card className={cn("border", getPositionStyle(3))}>
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-2">
                  <Medal className="w-6 h-6 text-orange-600" />
                </div>
                <div className="mx-auto mb-2">
                  {renderAvatar(top3.avatar_url, top3.nome_usuario, "md", "border border-orange-500 mx-auto")}
                </div>
                <h4 className="font-semibold text-sm truncate">{top3.nome_usuario || 'Usuário'}</h4>
                <p className="text-lg font-bold text-orange-500">{formatCurrency(top3.faturamento_total_mes)}</p>
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

      {/* Rest of Top 10 */}
      {restRanking.length > 0 && (
        <div className="space-y-2">
          {restRanking.map((user, index) => (
            <Card key={user.id} className="border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
              <CardContent className="p-3 flex items-center gap-3">
                <span className="w-8 text-center text-muted-foreground font-bold">
                  #{index + 4}
                </span>
                {renderAvatar(user.avatar_url, user.nome_usuario, "sm")}
                <div className="flex-1">
                  <p className="font-medium text-sm">{user.nome_usuario || 'Usuário'}</p>
                </div>
                <p className="font-bold text-muted-foreground">{formatCurrency(user.faturamento_total_mes)}</p>
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

      {/* Top 2 & 3 */}
      {(top2 || top3) && (
        <div className="grid grid-cols-2 gap-3">
          {top2 && (
            <Card className={cn("border", getPositionStyle(2))}>
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-2">
                  <Medal className="w-6 h-6 text-slate-400" />
                </div>
                <div className="mx-auto mb-2">
                  {renderAvatar(top2.avatar_url, top2.nome_usuario, "md", "border border-slate-400 mx-auto")}
                </div>
                <h4 className="font-semibold text-sm truncate">{top2.nome_usuario || 'Usuário'}</h4>
                <p className="text-lg font-bold text-slate-400">{top2.dias_trabalhados_mes} dias</p>
                <p className="text-xs text-muted-foreground">{top2.constancia_streak_atual} seguidos</p>
              </CardContent>
            </Card>
          )}

          {top3 && (
            <Card className={cn("border", getPositionStyle(3))}>
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-2">
                  <Medal className="w-6 h-6 text-orange-600" />
                </div>
                <div className="mx-auto mb-2">
                  {renderAvatar(top3.avatar_url, top3.nome_usuario, "md", "border border-orange-500 mx-auto")}
                </div>
                <h4 className="font-semibold text-sm truncate">{top3.nome_usuario || 'Usuário'}</h4>
                <p className="text-lg font-bold text-orange-500">{top3.dias_trabalhados_mes} dias</p>
                <p className="text-xs text-muted-foreground">{top3.constancia_streak_atual} seguidos</p>
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

      {/* Rest of Top 10 */}
      {restRanking.length > 0 && (
        <div className="space-y-2">
          {restRanking.map((user, index) => (
            <Card key={user.id} className="border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
              <CardContent className="p-3 flex items-center gap-3">
                <span className="w-8 text-center text-muted-foreground font-bold">
                  #{index + 4}
                </span>
                {renderAvatar(user.avatar_url, user.nome_usuario, "sm")}
                <div className="flex-1">
                  <p className="font-medium text-sm">{user.nome_usuario || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground">{user.constancia_streak_atual} seguidos</p>
                </div>
                <p className="font-bold text-muted-foreground">{user.dias_trabalhados_mes} dias</p>
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
