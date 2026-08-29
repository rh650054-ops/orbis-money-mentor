import { Trophy, ChevronRight } from "lucide-react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { getTier } from "@/components/ranking/tier";

interface RankingCardProps {
  userId: string;
  onClick: () => void;
}

export default function RankingCard({ userId, onClick }: RankingCardProps) {
  const { currentUserStats, hasParticipated, isLoading } = useLeaderboard(userId);

  const pos = currentUserStats?.posicao_faturamento ?? null;
  const inRank = hasParticipated && !!currentUserStats && !!pos;
  const tier = inRank ? getTier(pos as number) : null;
  const accent = tier?.color;
  const loadingStats = isLoading && !currentUserStats;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-card px-4 py-3.5 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden">
        {tier ? (
          <img src={tier.icon} alt={tier.label} className="w-8 h-8 object-contain" />
        ) : (
          <Trophy className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Ranking</p>
        {loadingStats ? (
          <div className="h-3 w-24 rounded bg-muted animate-pulse mt-1" />
        ) : inRank ? (
          <p className="text-xs text-muted-foreground truncate">
            <span className="font-medium" style={accent ? { color: accent } : undefined}>{tier!.label}</span>
            {" · Top "}{pos}
            {!!currentUserStats!.dias_trabalhados_mes && ` · ${currentUserStats!.dias_trabalhados_mes} dias`}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Registre vendas e dispute o pódio</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
