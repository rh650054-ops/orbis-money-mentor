import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Lock, Check, Sparkles, Trophy, Zap, Crown, Star, Target, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";

const formatThreshold = (v: number) =>
  v >= 1_000_000 ? `R$ ${v / 1_000_000}M` : `R$ ${v / 1_000}K`;

type Tier = {
  name: string;
  threshold: number;
  tagline: string;
  rewards: string[];
  accent: string;
  emoji: string;
  icon: React.ReactNode;
  level: number;
  colorClass: string;
  glowColor: string;
  rarity: string;
  rarityColor: string;
  bgGradient: string;
  xpRequired: number;
};

const TIERS: Tier[] = [
  {
    name: "Semente",
    level: 1,
    threshold: 10_000,
    xpRequired: 1000,
    tagline: "O começo de tudo",
    accent: "hsl(140 70% 45%)",
    emoji: "🌱",
    icon: <Target className="h-5 w-5" />,
    colorClass: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    glowColor: "shadow-emerald-500/20",
    rarity: "Comum",
    rarityColor: "text-emerald-400",
    bgGradient: "from-emerald-500/10 via-transparent to-transparent",
    rewards: [
      "Selo Semente no perfil",
      "Acesso à comunidade Orbis",
      "Trilha de planejamento avançado",
    ],
  },
  {
    name: "Brasa",
    level: 2,
    threshold: 50_000,
    xpRequired: 5000,
    tagline: "O fogo está aceso",
    accent: "hsl(25 95% 55%)",
    emoji: "🔥",
    icon: <Zap className="h-5 w-5" />,
    colorClass: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
    glowColor: "shadow-orange-500/20",
    rarity: "Incomum",
    rarityColor: "text-orange-400",
    bgGradient: "from-orange-500/10 via-transparent to-transparent",
    rewards: [
      "1 mês grátis de assinatura",
      "Selo Brasa exclusivo",
      "Workshops mensais ao vivo",
    ],
  },
  {
    name: "Forja",
    level: 3,
    threshold: 100_000,
    xpRequired: 10000,
    tagline: "Você está moldando seu futuro",
    accent: "hsl(45 95% 55%)",
    emoji: "⚒️",
    icon: <Trophy className="h-5 w-5" />,
    colorClass: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
    glowColor: "shadow-amber-500/20",
    rarity: "Raro",
    rarityColor: "text-amber-400",
    bgGradient: "from-amber-500/10 via-transparent to-transparent",
    rewards: [
      "3 meses grátis de assinatura",
      "Convite para grupo VIP",
      "Mentoria coletiva trimestral",
    ],
  },
  {
    name: "Lenda",
    level: 5,
    threshold: 1_000_000,
    xpRequired: 100000,
    tagline: "Top 1% — você é referência",
    accent: "hsl(200 90% 60%)",
    emoji: "⭐",
    icon: <Star className="h-5 w-5" />,
    colorClass: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30",
    glowColor: "shadow-cyan-500/20",
    rarity: "Lendário",
    rarityColor: "text-cyan-400",
    bgGradient: "from-cyan-500/10 via-transparent to-transparent",
    rewards: [
      "Mentoria 1:1 com fundador",
      "Acesso vitalício ao Orbis",
      "Reconhecimento na Hall of Fame",
    ],
  },
];

export default function Rewards() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("daily_sales")
        .select("total_profit")
        .eq("user_id", user.id);
      const total = (data || []).reduce(
        (s, d) => s + (d.total_profit || 0),
        0
      );
      setTotalRevenue(total);
    })();
  }, [user]);

  // Find next tier (not yet reached)
  const nextTierIdx = TIERS.findIndex((t) => totalRevenue < t.threshold);
  const currentTierIdx = nextTierIdx === -1 ? TIERS.length - 1 : nextTierIdx - 1;
  const nextTier = nextTierIdx === -1 ? null : TIERS[nextTierIdx];
  const progressToNext = nextTier
    ? Math.min((totalRevenue / nextTier.threshold) * 100, 100)
    : 100;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-5 py-4 max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-muted/30 rounded-lg transition-colors"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Recompensas</h1>
          <div className="w-9" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 pt-6 space-y-6">
        {/* Hero — current status + progress to next */}
        <div className="rounded-3xl bg-gradient-to-br from-primary/15 via-card to-card border border-primary/30 p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Faturamento total
              </p>
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30">
              <span className="text-base leading-none">
                {currentTierIdx >= 0 ? TIERS[currentTierIdx].emoji : "✨"}
              </span>
              <span className="text-xs font-bold text-primary">
                {currentTierIdx >= 0 ? TIERS[currentTierIdx].name : "Iniciante"}
              </span>
            </div>
          </div>

          {nextTier ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Próximo: {nextTier.name}</span>
                <span>
                  faltam {formatCurrency(nextTier.threshold - totalRevenue)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all"
                  style={{ width: `${progressToNext}%` }}
                />
              </div>
              <p className="text-xs text-right text-primary font-medium">
                {progressToNext.toFixed(1)}%
              </p>
            </div>
          ) : (
            <p className="text-sm text-primary font-medium">
              🏆 Você desbloqueou todos os tiers!
            </p>
          )}
        </div>

        {/* Tier list */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">
            Sua jornada
          </p>

          {TIERS.map((tier, idx) => {
            const isUnlocked = totalRevenue >= tier.threshold;
            const isCurrent = !isUnlocked && idx === nextTierIdx;
            const isExpanded = expanded === tier.name;
            const prevThreshold = idx === 0 ? 0 : TIERS[idx - 1].threshold;
            const tierProgress = isUnlocked
              ? 100
              : Math.max(
                  0,
                  Math.min(
                    ((totalRevenue - prevThreshold) / (tier.threshold - prevThreshold)) * 100,
                    100
                  )
                );

            return (
              <button
                key={tier.name}
                onClick={() => setExpanded(isExpanded ? null : tier.name)}
                className="w-full text-left group"
              >
                <div
                  className="relative overflow-hidden rounded-2xl border transition-all"
                  style={{
                    background: isUnlocked
                      ? `linear-gradient(135deg, ${tier.accent}28 0%, hsl(var(--card)) 55%, hsl(var(--card)) 100%)`
                      : isCurrent
                      ? `linear-gradient(135deg, ${tier.accent}18 0%, hsl(var(--card)) 60%, hsl(var(--card)) 100%)`
                      : "hsl(var(--card) / 0.5)",
                    borderColor: isUnlocked
                      ? `${tier.accent}66`
                      : isCurrent
                      ? `${tier.accent}55`
                      : "hsl(var(--border) / 0.6)",
                    boxShadow: isUnlocked
                      ? `0 8px 32px -12px ${tier.accent}70, inset 0 1px 0 ${tier.accent}25`
                      : isCurrent
                      ? `0 6px 24px -14px ${tier.accent}55`
                      : "none",
                  }}
                >
                  {(isUnlocked || isCurrent) && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                      <div
                        className="absolute -top-1/2 -left-1/4 h-[200%] w-1/3 animate-shine-sweep"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${tier.accent}25, transparent)`,
                        }}
                      />
                    </div>
                  )}

                  {!isUnlocked && !isCurrent && (
                    <div
                      className="pointer-events-none absolute inset-0 rounded-2xl"
                      style={{
                        background:
                          "repeating-linear-gradient(45deg, hsl(0 0% 0% / 0.35) 0px, hsl(0 0% 0% / 0.35) 6px, transparent 6px, transparent 12px)",
                      }}
                    />
                  )}

                  <div className="relative flex items-center gap-4 p-4">
                    <div
                      className={`relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                        isUnlocked ? "animate-float" : ""
                      }`}
                      style={{
                        background: isUnlocked
                          ? `linear-gradient(135deg, ${tier.accent}, ${tier.accent}60)`
                          : isCurrent
                          ? `linear-gradient(135deg, ${tier.accent}40, ${tier.accent}15)`
                          : "hsl(var(--muted))",
                        boxShadow: isUnlocked
                          ? `0 0 24px -4px ${tier.accent}, inset 0 1px 0 ${tier.accent}80`
                          : isCurrent
                          ? `0 0 16px -6px ${tier.accent}80`
                          : "none",
                        border: isUnlocked || isCurrent ? `1px solid ${tier.accent}55` : "1px solid hsl(var(--border))",
                        filter: !isUnlocked && !isCurrent ? "grayscale(0.85) opacity(0.55)" : "none",
                      }}
                    >
                      <span className="text-3xl leading-none drop-shadow-lg">{tier.emoji}</span>
                      <div
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-background"
                        style={{
                          background: isUnlocked ? tier.accent : "hsl(var(--muted))",
                          color: isUnlocked ? "white" : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {tier.level}
                      </div>
                      {isUnlocked ? (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />
                        </div>
                      ) : (
                        <div
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center"
                          style={{ background: "hsl(var(--muted))" }}
                        >
                          <Lock className="h-2.5 w-2.5 text-muted-foreground" strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-[10px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded"
                          style={{
                            background: isUnlocked || isCurrent ? `${tier.accent}20` : "hsl(var(--muted))",
                            color: isUnlocked || isCurrent ? tier.accent : "hsl(var(--muted-foreground))",
                          }}
                        >
                          Nv {tier.level} • {tier.rarity}
                        </span>
                      </div>
                      <p
                        className={`font-black text-base leading-tight mt-1 ${
                          isUnlocked ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        Patente {tier.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tier.tagline}
                      </p>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p
                        className="text-sm font-black"
                        style={{
                          color: isUnlocked || isCurrent ? tier.accent : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {formatThreshold(tier.threshold)}
                      </p>
                      <ChevronRight
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {isCurrent && (
                    <div className="relative px-4 pb-4 -mt-1">
                      <div className="relative h-1.5 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                          style={{
                            width: `${tierProgress}%`,
                            background: `linear-gradient(90deg, ${tier.accent}, ${tier.accent}aa)`,
                            boxShadow: `0 0 10px ${tier.accent}90`,
                          }}
                        >
                          <div
                            className="absolute inset-0 animate-shine-sweep"
                            style={{
                              background:
                                "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.4), transparent)",
                            }}
                          />
                        </div>
                      </div>
                      <p
                        className="text-[10px] font-bold text-right mt-1"
                        style={{ color: tier.accent }}
                      >
                        {tierProgress.toFixed(0)}% rumo a {tier.name}
                      </p>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="relative px-4 pb-4 pt-0 animate-fade-in">
                      <div
                        className="rounded-xl p-4 space-y-2 backdrop-blur-sm"
                        style={{
                          background: isUnlocked ? `${tier.accent}12` : "hsl(var(--muted) / 0.4)",
                          border: `1px solid ${isUnlocked ? tier.accent + "35" : "hsl(var(--border))"}`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {!isUnlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                            {isUnlocked ? "Recompensas conquistadas" : "Você desbloqueia"}
                          </p>
                        </div>
                        {tier.rewards.map((r) => (
                          <div key={r} className="flex items-start gap-2.5">
                            <div
                              className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                background: isUnlocked ? tier.accent : "hsl(var(--muted-foreground))",
                              }}
                            />
                            <p
                              className={`text-sm ${
                                isUnlocked ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {r}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground pt-2">
          Recompensas baseadas no seu faturamento total acumulado
        </p>
      </div>
    </div>
  );
}
