import { useState, useEffect, useRef } from "react";
import { Trophy, Crown, Medal, Flame, TrendingUp, ChevronRight, Star, Zap, AlertCircle, Edit2, Camera, Sparkles, Share2, Download, Loader2, Gift, Shield } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Progress } from "@/shared/ui/progress";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard, LeaderboardEntry } from "@/hooks/useLeaderboard";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Skeleton } from "@/shared/ui/skeleton";
import { RankingProfileModal } from "@/components/RankingProfileModal";
import PublicProfileModal from "@/components/PublicProfileModal";
import { RankingShareCard } from "@/components/RankingShareCard";
import { RankingChase } from "@/components/ranking/RankingChase";
import { RankingPodium } from "@/components/ranking/RankingPodium";
import { getTier, leagueRank } from "@/components/ranking/tier";
import { LeagueTransition } from "@/components/ranking/LeagueTransition";
import { TrialNudge } from "@/components/TrialNudge";
import { RankingList } from "@/components/ranking/RankingList";
import CompetitionsTab from "@/components/ranking/CompetitionsTab";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toPng } from "html-to-image";
import { toast } from "@/shared/hooks/use-toast";
import confetti from "canvas-confetti";
import { RANKING_FIRE_GRADIENT, RANKING_TIER_COLORS, readThemeColor } from "@/shared/lib/theme-colors";
import { useRefetchOnFocus } from "@/shared/hooks/use-refetch-on-focus";

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

function renderAvatar(avatar: string | null, name: string | null, size: "sm" | "md" | "lg" = "md", className?: string, badgeIcon?: string) {
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
  if (badgeIcon) {
    return <img src={badgeIcon} alt={name || ''} className={cn("object-contain", sizeClasses[size])} />;
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

  const [activeTab, setActiveTab] = useState<"global" | "competicoes">("global");
  const navigate = useNavigate();
  const { whitelisted, role } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";
  const [userPhone, setUserPhone] = useState<string>("");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const quickPhotoRef = useRef<HTMLInputElement>(null);
  const [quickUploading, setQuickUploading] = useState(false);
  const [leagueTransition, setLeagueTransition] = useState<{ type: "up" | "down"; position: number } | null>(null);
  const [showRankNudge, setShowRankNudge] = useState(false);
  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const prevFaturamentoPosition = useRef<number | null>(null);
  const prevConstanciaPosition = useRef<number | null>(null);

  const [userProfile, setUserProfile] = useState({ nickname: '', avatar: '' });

  const loadUserProfile = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("profiles")
      .select("nickname, avatar_url, phone, whatsapp_public")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setUserProfile({ nickname: data.nickname || '', avatar: data.avatar_url || '' });
      setUserPhone(data.phone || data.whatsapp_public || '');
    }
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
      const colors = [...RANKING_FIRE_GRADIENT];
      confetti({ particleCount, startVelocity: 30, spread: 360, origin: { x: r(0.1, 0.3), y: Math.random() - 0.2 }, colors });
      confetti({ particleCount, startVelocity: 30, spread: 360, origin: { x: r(0.7, 0.9), y: Math.random() - 0.2 }, colors });
    }, 250);
  };

  useEffect(() => { loadUserProfile(); }, [user?.id]);

  // Anima quando o vendedor SOBE ou CAI de liga (compara com a ultima liga vista)
  useEffect(() => {
    const pos = currentUserStats?.posicao_faturamento;
    if (!user?.id || !pos) return;
    const rank = leagueRank(pos);
    const key = `orbis_last_league_${user.id}`;
    let stored = 0;
    try { stored = Number(localStorage.getItem(key)) || 0; } catch { /* noop */ }
    if (stored && stored !== rank) {
      setLeagueTransition({ type: rank > stored ? "up" : "down", position: pos });
    }
    try { localStorage.setItem(key, String(rank)); } catch { /* noop */ }
  }, [currentUserStats?.posicao_faturamento, user?.id]);

  // Recarrega ranking e perfil ao voltar o foco (ex.: retorno do DEFCON 4)
  useRefetchOnFocus(() => {
    if (user) {
      loadLeaderboard();
      loadUserProfile();
    }
  });

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const handleQuickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione uma imagem válida", variant: "destructive" });
      return;
    }
    setQuickUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/avatar.${ext}`;
      await supabase.storage.from("avatars").remove([filePath]);
      const { error } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      const mref = new Date().toISOString().slice(0, 7);
      await supabase.from("leaderboard_stats").update({ avatar_url: url }).eq("user_id", user.id).eq("mes_referencia", mref);
      toast({ title: "Foto atualizada! 📸" });
      loadUserProfile();
      loadLeaderboard();
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao enviar a foto", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setQuickUploading(false);
      if (quickPhotoRef.current) quickPhotoRef.current.value = "";
    }
  };

  const openPublicProfile = (uid: string) => {
    if (!uid) return;
    setPublicProfileUserId(uid);
  };

  const isGlobal = activeTab === "global";

  const handleShare = async () => {
    if (!shareCardRef.current || isSharing) return;
    setIsSharing(true);
    try {
      // Pequeno delay para garantir que o card off-screen foi renderizado
      await new Promise((r) => setTimeout(r, 50));
      const dataUrl = await toPng(shareCardRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: 1080,
        height: 1920,
        backgroundColor: readThemeColor("--background"),
      });

      // Tenta Web Share API com arquivo (mobile)
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `orbis-ranking-${activeTab}.png`, { type: "image/png" });

      const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: "Meu ranking no Orbis",
          text: "Veja minha posição no ranking do Orbis 🏆",
        });
      } else {
        // Fallback: download
        const link = document.createElement("a");
        link.download = `orbis-ranking-${activeTab}.png`;
        link.href = dataUrl;
        link.click();
        toast({
          title: "Imagem baixada!",
          description: "Compartilhe agora no seu Instagram 📲",
        });
      }
    } catch (err) {
      console.error("Erro ao compartilhar:", err);
      toast({
        title: "Não foi possível compartilhar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };

  // Dados para o share card (sempre Liga Global = faturamento)
  const shareData = (() => {
    const totalParticipants = faturamentoRanking.length;
    const position = currentUserStats?.posicao_faturamento ?? null;
    const primaryValue = formatCurrency(currentUserStats?.faturamento_total_mes ?? 0);
    const secondaryValue = `${currentUserStats?.constancia_streak_atual ?? 0} dias seguidos 🔥`;
    return {
      league: "faturamento" as const,
      position,
      totalParticipants,
      nickname: userProfile.nickname || currentUserStats?.nome_usuario || "Vendedor",
      avatarUrl: userProfile.avatar || currentUserStats?.avatar_url || null,
      primaryValue,
      secondaryValue,
      monthLabel: currentMonth,
    };
  })();

  if (isLoading) {
    return (
      <div className="pb-8 space-y-6">
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

  return (
    <div className="pb-8 space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Ranking <span className="text-primary">Orbis</span>
        </h1>
        <p className="text-muted-foreground capitalize text-sm">{currentMonth}</p>
      </div>

      {showRankNudge && user && (
        <TrialNudge
          userId={user.id}
          momentKey="ranking_promo"
          title="Você subiu de patente! 🏆"
          benefit="Cada venda te faz subir no ranking. Quando o teste acabar, você sai da disputa e perde seu lugar."
        />
      )}

      {/* Tabs: Liga Global + Competições */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => setActiveTab("global")}
          className={cn(
            "relative overflow-hidden rounded-xl p-3.5 text-left transition-[colors,transform,opacity] duration-300 border",
            isGlobal
              ? "bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/50 shadow-lg shadow-primary/20"
              : "bg-card/40 border-border/50 hover:border-primary/30",
          )}
        >
          {isGlobal && (
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
          )}
          <div className="relative flex items-center gap-2.5">
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                isGlobal ? "bg-primary text-primary-foreground" : "bg-card border border-border/50 text-muted-foreground",
              )}
            >
              <Trophy className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className={cn("text-xs font-bold uppercase tracking-widest", isGlobal ? "text-primary" : "text-muted-foreground")}>
                Liga
              </p>
              <p className={cn("text-sm font-black truncate", isGlobal ? "text-foreground" : "text-foreground/70")}>
                Global
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("competicoes")}
          className={cn(
            "relative overflow-hidden rounded-xl p-3.5 text-left transition-[colors,transform,opacity] duration-300 border",
            !isGlobal
              ? "bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border-primary/50 shadow-lg shadow-primary/20"
              : "bg-card/40 border-border/50 hover:border-primary/30",
          )}
        >
          {!isGlobal && (
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
          )}
          <div className="relative flex items-center gap-2.5">
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                !isGlobal ? "bg-primary text-primary-foreground" : "bg-card border border-border/50 text-muted-foreground",
              )}
            >
              <Gift className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className={cn("text-xs font-bold uppercase tracking-widest", !isGlobal ? "text-primary" : "text-muted-foreground")}>
                Competições
              </p>
              <p className={cn("text-sm font-black truncate", !isGlobal ? "text-foreground" : "text-foreground/70")}>
                Com prêmios
              </p>
            </div>
          </div>
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground -mt-2">
        {isGlobal
          ? "Maiores vendedores do mês · ofensiva 🔥 incluída"
          : "Torneios semanais e mensais com prêmios reais"}
      </p>

      {isAdmin && !isGlobal && (
        <button
          onClick={() => navigate("/admin/competitions")}
          className="w-full rounded-xl border-2 border-primary/50 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 px-3 py-3 flex items-center justify-center gap-2 text-sm font-black text-primary hover:from-primary/25 hover:to-primary/25 transition"
          style={{ boxShadow: "0 6px 20px -8px hsl(var(--primary) / 0.5)" }}
        >
          <Shield className="w-4 h-4" />
          Admin · Criar / gerenciar competições
        </button>
      )}

      {isGlobal && (
        <>
          {/* Compartilhar no Instagram */}
          {hasParticipated && currentUserStats && (
            <button
              data-tour="ranking-share"
              onClick={handleShare}
              disabled={isSharing}
              className="group relative w-full overflow-hidden rounded-2xl px-4 py-3.5 transition-[colors,transform,opacity] active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(95deg, #FEDA77 0%, #F58529 24%, #DD2A7B 56%, #8134AF 80%, #515BD4 100%)", boxShadow: "0 10px 30px -10px rgba(221,42,123,0.55)" }}
            >
              <div className="relative flex items-center justify-center gap-2.5">
                {isSharing ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Share2 className="w-5 h-5 text-white" />
                )}
                <div className="text-left">
                  <p className="text-sm font-black text-white tracking-wide" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                    {isSharing ? "Gerando imagem..." : "Compartilhar no Instagram"}
                  </p>
                  <p className="text-xs text-white/85 uppercase tracking-widest">
                    Story 9:16 · pronto pra postar
                  </p>
                </div>
              </div>
            </button>
          )}

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

          <FaturamentoLeague
            ranking={faturamentoRanking}
            currentUserStats={currentUserStats}
            hasParticipated={hasParticipated}
            formatCurrency={formatCurrency}
            onEditProfile={() => { loadUserProfile(); setProfileModalOpen(true); }}
            onOpenProfile={openPublicProfile}
            onQuickPhoto={() => quickPhotoRef.current?.click()}
            quickUploading={quickUploading}
          />
        </>
      )}

      {!isGlobal && (
        <CompetitionsTab userId={user?.id} hasPhone={!!userPhone} />
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

      <input ref={quickPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleQuickPhoto} />

      {leagueTransition && (
        <LeagueTransition
          type={leagueTransition.type}
          position={leagueTransition.position}
          onClose={() => { const up = leagueTransition?.type === "up"; setLeagueTransition(null); if (up) setShowRankNudge(true); }}
        />
      )}

      {/* Off-screen Instagram Story Card (1080x1920) */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: -99999,
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        <RankingShareCard ref={shareCardRef} {...shareData} />
      </div>
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
  onQuickPhoto: () => void;
  quickUploading: boolean;
}

function FaturamentoLeague({ ranking, currentUserStats, hasParticipated, formatCurrency, onEditProfile, onOpenProfile, onQuickPhoto, quickUploading }: FaturamentoLeagueProps) {
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
      <RankingPodium top1={top1} top2={top2} top3={top3} formatCurrency={formatCurrency} onOpenProfile={onOpenProfile} />

      {/* A cacada - quem esta logo na frente */}
      {hasParticipated && (
        <RankingChase ranking={ranking} me={currentUserStats} formatCurrency={formatCurrency} />
      )}

      {/* Your Position */}
      {hasParticipated && currentUserStats && (
        <Card className="relative overflow-hidden border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <CardContent className="relative p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative shrink-0">
                <button onClick={onQuickPhoto} className="block active:scale-95 transition-transform" title="Trocar foto">
                  {renderAvatar(currentUserStats.avatar_url, currentUserStats.nome_usuario, "sm", "border border-primary/50", getTier(currentUserStats.posicao_faturamento || 999).icon)}
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-lg">
                    {quickUploading ? <Loader2 className="w-2.5 h-2.5 text-primary-foreground animate-spin" /> : <Camera className="w-2.5 h-2.5 text-primary-foreground" />}
                  </span>
                </button>
                <button
                  onClick={onEditProfile}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-card border border-primary/50 flex items-center justify-center shadow hover:bg-primary/20 transition-colors"
                  title="Editar perfil"
                >
                  <Edit2 className="w-2.5 h-2.5 text-primary" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-black tracking-widest">VOCÊ</span>
                  <span className="text-muted-foreground text-sm font-semibold">#{currentUserStats.posicao_faturamento}</span>
                </div>
                <p className="text-lg font-black text-foreground mt-0.5">{formatCurrency(currentUserStats.faturamento_total_mes)}</p>
              </div>
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-primary/25 to-primary/10 border border-primary/40 shrink-0">
                <Flame className="w-3.5 h-3.5 text-primary fill-primary/40" />
                <span className="text-xs font-black text-primary">{currentUserStats.constancia_streak_atual}</span>
              </div>
            </div>
            {currentPosition > 1 && nextPositionValue > currentValue && (
              <div className="space-y-2 pt-2 border-t border-primary/15">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Para subir para #{currentPosition - 1}</span>
                  <span className="text-primary font-bold">+{formatCurrency(nextPositionValue - currentValue)}</span>
                </div>
                <Progress value={progressToNext} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <RankingList ranking={ranking} me={currentUserStats} formatCurrency={formatCurrency} onOpenProfile={onOpenProfile} />
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
                <Flame className="w-7 h-7 text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.6)]" />
                <span className="text-sm font-black text-primary tracking-wider">TOP 1</span>
              </div>
              <div className="flex items-center gap-1 text-primary">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-bold">{top1.constancia_streak_atual} dias seguidos</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button onClick={() => onOpenProfile(top1.user_id)} className="relative shrink-0 active:scale-95 transition-transform">
                <div className="absolute -inset-1.5 bg-primary rounded-full blur-md opacity-40" />
                {renderAvatar(top1.avatar_url, top1.nome_usuario, "lg", "shadow-2xl shadow-primary/40 border-2 border-primary relative z-10")}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-background z-20">
                  <Flame className="w-4 h-4 text-primary-foreground" />
                </div>
              </button>
              <button onClick={() => onOpenProfile(top1.user_id)} className="flex-1 min-w-0 text-left">
                <h3 className="text-xl font-bold text-foreground truncate hover:text-primary transition-colors">{top1.nome_usuario || 'Usuário'}</h3>
                <p className="text-2xl font-black text-primary">{top1.dias_trabalhados_mes} dias</p>
                <p className="text-xs text-muted-foreground italic mt-0.5">"Disciplina é o caminho da vitória!"</p>
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
                      <span className="absolute -top-1 -right-1 text-xs font-black text-foreground/70">2</span>
                    </div>
                  </div>
                  <div className="relative mx-auto mb-2 w-fit">
                    {renderAvatar(top2.avatar_url, top2.nome_usuario, "md", "border border-foreground/30 mx-auto shadow-md")}
                  </div>
                  <h4 className="font-bold text-xs truncate text-foreground">{top2.nome_usuario || 'Usuário'}</h4>
                  <p className="text-base font-black text-foreground mt-0.5">{top2.dias_trabalhados_mes} dias</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{top2.constancia_streak_atual} seguidos</p>
                  <div className="mt-2 px-2 py-0.5 rounded-full bg-foreground/10 border border-foreground/20 inline-flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-foreground/70" />
                    <span className="text-xs font-semibold text-foreground/70 tracking-wider">PRATA</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          )}

          {top3 && (
            <button onClick={() => onOpenProfile(top3.user_id)} className="text-left">
              <Card className="relative overflow-hidden border border-bronze/50 bg-card hover:border-bronze/70 transition-colors">
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-bronze/15 rounded-full blur-2xl" />
                <CardContent className="relative p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="relative">
                      <Medal className="w-7 h-7 text-bronze" />
                      <span className="absolute -top-1 -right-1 text-xs font-black text-bronze">3</span>
                    </div>
                  </div>
                  <div className="relative mx-auto mb-2 w-fit">
                    {renderAvatar(top3.avatar_url, top3.nome_usuario, "md", "border border-bronze/60 mx-auto shadow-md")}
                  </div>
                  <h4 className="font-bold text-xs truncate text-foreground">{top3.nome_usuario || 'Usuário'}</h4>
                  <p className="text-base font-black text-foreground mt-0.5">{top3.dias_trabalhados_mes} dias</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{top3.constancia_streak_atual} seguidos</p>
                  <div className="mt-2 px-2 py-0.5 rounded-full bg-bronze/15 border border-bronze/40 inline-flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-bronze" />
                    <span className="text-xs font-semibold text-bronze tracking-wider">BRONZE</span>
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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-bold tracking-wider">VOCÊ</span>
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
              <Card className="group relative overflow-hidden border border-border/50 bg-card hover:border-primary/40 transition-[colors,transform,opacity] duration-300">
                <CardContent className="relative p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-foreground/5 border border-foreground/15 flex items-center justify-center shrink-0">
                    <span className="text-sm font-black text-foreground/80">{index + 4}</span>
                  </div>
                  {renderAvatar(u.avatar_url, u.nome_usuario, "sm", "border border-border/50")}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{u.nome_usuario || 'Usuário'}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Flame className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{u.constancia_streak_atual} seguidos</span>
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
