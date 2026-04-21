import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";

type Tier = {
  name: string;
  min: number;
  max: number;
  emoji: string;
  rewards: string[];
};

const TIERS: Tier[] = [
  {
    name: "Solaris",
    min: 500_000,
    max: 1_000_000,
    emoji: "🪩",
    rewards: [
      "Mentoria 1:1 com fundador",
      "Acesso vitalício ao Orbis",
      "Reconhecimento na comunidade Top 1%",
    ],
  },
  {
    name: "Dune",
    min: 250_000,
    max: 500_000,
    emoji: "🌟",
    rewards: [
      "Plano anual grátis",
      "Selo Dune no perfil",
      "Acesso a workshops exclusivos",
    ],
  },
  {
    name: "Oasis",
    min: 100_000,
    max: 250_000,
    emoji: "🌵",
    rewards: [
      "3 meses grátis de assinatura",
      "Selo Oasis no perfil",
      "Convite para grupo VIP",
    ],
  },
  {
    name: "Mirage",
    min: 10_000,
    max: 100_000,
    emoji: "🌱",
    rewards: [
      "1 mês grátis de assinatura",
      "Selo Mirage no perfil",
      "Templates de planejamento avançado",
    ],
  },
  {
    name: "Início",
    min: 0,
    max: 10_000,
    emoji: "🌿",
    rewards: [
      "Acesso ao app Orbis",
      "Comunidade de vendedores",
      "Trilha de onboarding",
    ],
  },
];

const formatRange = (min: number, max: number) => {
  const fmt = (v: number) =>
    v >= 1_000_000 ? `${v / 1_000_000}M` : `${v / 1_000}K`;
  return `${fmt(min)} - ${fmt(max)}`;
};

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

  const currentTierIndex = TIERS.findIndex(
    (t) => totalRevenue >= t.min && totalRevenue < t.max
  );
  const activeIdx =
    currentTierIndex === -1 ? (totalRevenue >= 1_000_000 ? 0 : TIERS.length - 1) : currentTierIndex;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pb-24">
      {/* Stars background */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-foreground/30"
            style={{
              width: Math.random() * 3 + 1 + "px",
              height: Math.random() * 3 + 1 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.6 + 0.2,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between px-5 pt-6 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-muted/30 rounded-lg transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Rank</h1>
        <div className="w-10" />
      </div>

      {/* Total revenue chip */}
      <div className="relative px-5 mb-4 text-center">
        <p className="text-xs text-muted-foreground">Faturamento total</p>
        <p className="text-xl font-bold text-foreground">
          {formatCurrency(totalRevenue)}
        </p>
      </div>

      {/* Path with tiers */}
      <div className="relative px-5">
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 350 900"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="pathGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.3" />
              <stop offset="60%" stopColor="hsl(45 90% 55%)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="hsl(140 70% 45%)" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path
            d="M 60 60 C 280 120, 280 220, 100 290 S 60 480, 280 540 S 100 720, 200 850"
            stroke="url(#pathGradient)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
        </svg>

        <div className="relative space-y-12 py-6">
          {TIERS.map((tier, idx) => {
            const isActive = idx === activeIdx;
            const isUnlocked = totalRevenue >= tier.min;
            const alignLeft = idx % 2 === 0;
            const isExpanded = expanded === tier.name;

            return (
              <div
                key={tier.name}
                className={`flex ${alignLeft ? "justify-start" : "justify-end"}`}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : tier.name)}
                  className={`relative w-[78%] text-left rounded-2xl border transition-all ${
                    isActive
                      ? "border-primary bg-card shadow-[0_0_20px_hsl(var(--primary)/0.25)]"
                      : isUnlocked
                      ? "border-success/40 bg-card/80"
                      : "border-border bg-card/60"
                  }`}
                >
                  {/* Node dot */}
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 ${
                      alignLeft ? "-left-3" : "-right-3"
                    } w-4 h-4 rounded-full ring-4 ring-background ${
                      isUnlocked ? "bg-success" : "bg-muted-foreground/40"
                    }`}
                  />

                  <div className="flex items-center gap-3 p-4">
                    <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center text-2xl shrink-0">
                      {tier.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{tier.name}</p>
                      <p className="text-sm text-success">
                        {formatRange(tier.min, tier.max)}
                      </p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border/50 animate-fade-in">
                      <p className="text-xs text-muted-foreground mb-2 mt-3">
                        Recompensas:
                      </p>
                      <ul className="space-y-1.5">
                        {tier.rewards.map((r) => (
                          <li
                            key={r}
                            className="text-sm text-foreground flex items-start gap-2"
                          >
                            <span className="text-success mt-0.5">✓</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
