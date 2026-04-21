import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Lock, Check, Sparkles, Trophy, Zap, Crown, Star, Target, Gem, Medal, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";

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
};

const TIERS: Tier[] = [
  {
    name: "Semente",
    level: 1,
    threshold: 10_000,
    tagline: "O começo de tudo",
    accent: "hsl(140 70% 45%)",
    emoji: "🌱",
    icon: <Target className="h-5 w-5" />,
    colorClass: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    glowColor: "shadow-emerald-500/20",
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
    tagline: "O fogo está aceso",
    accent: "hsl(25 95% 55%)",
    emoji: "🔥",
    icon: <Zap className="h-5 w-5" />,
    colorClass: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
    glowColor: "shadow-orange-500/20",
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
    tagline: "Você está moldando seu futuro",
    accent: "hsl(45 95% 55%)",
    emoji: "⚒️",
    icon: <Trophy className="h-5 w-5" />,
    colorClass: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
    glowColor: "shadow-amber-500/20",
    rewards: [
      "3 meses grátis de assinatura",
      "Convite para grupo VIP",
      "Mentoria coletiva trimestral",
    ],
  },
  {
    name: "Império",
    level: 4,
    threshold: 500_000,
    tagline: "Reconhecido entre os melhores",
    accent: "hsl(280 70% 60%)",
    emoji: "👑",
    icon: <Crown className="h-5 w-5" />,
    colorClass: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    glowColor: "shadow-purple-500/20",
    rewards: [
      "Plano anual grátis",
      "Selo Império holográfico",
      "Acesso antecipado a novos recursos",
    ],
  },
  {
    name: "Lenda",
    level: 5,
    threshold: 1_000_000,
    tagline: "Top 1% — você é referência",
    accent: "hsl(200 90% 60%)",
    emoji: "⭐",
    icon: <Star className="h-5 w-5" />,
    colorClass: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30",
    glowColor: "shadow-cyan-500/20",
    rewards: [
      "Mentoria 1:1 com fundador",
      "Acesso vitalício ao Orbis",
      "Reconhecimento na Hall of Fame",
    ],
  },
];

const formatThreshold = (v: number) =>
  v >= 1_000_000 ? `R$ ${v / 1_000_000}M` : `R$ ${v / 1_000}K`;

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
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">
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
            const isCurrent = idx === currentTierIdx + (nextTierIdx === -1 ? 0 : 0) && !isUnlocked && idx === nextTierIdx;
            const isExpanded = expanded === tier.name;

            return (
              <button
                key={tier.name}
                onClick={() => setExpanded(isExpanded ? null : tier.name)}
                className={`w-full text-left rounded-2xl border transition-all overflow-hidden ${
                  isCurrent
                    ? "border-primary bg-card shadow-[0_0_24px_-8px_hsl(var(--primary)/0.4)]"
                    : isUnlocked
                    ? "border-border bg-card"
                    : "border-border/60 bg-card/50"
                }`}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Tier number badge */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 relative"
                    style={{
                      background: isUnlocked
                        ? `linear-gradient(135deg, ${tier.accent}, ${tier.accent}80)`
                        : "hsl(var(--muted))",
                      color: isUnlocked ? "white" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {isUnlocked ? (
                      <Check className="h-5 w-5" strokeWidth={3} />
                    ) : (
                      <span className="text-base">0{idx + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{tier.name}</p>
                      {!isUnlocked && (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {tier.tagline}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className="text-sm font-bold"
                      style={{
                        color: isUnlocked ? tier.accent : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {formatThreshold(tier.threshold)}
                    </p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 animate-fade-in">
                    <div
                      className="rounded-xl p-4 space-y-2"
                      style={{
                        background: `${tier.accent}10`,
                        border: `1px solid ${tier.accent}30`,
                      }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        O que você ganha
                      </p>
                      {tier.rewards.map((r) => (
                        <div key={r} className="flex items-start gap-2.5">
                          <div
                            className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: tier.accent }}
                          />
                          <p className="text-sm text-foreground">{r}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
