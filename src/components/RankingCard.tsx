import { Trophy, ChevronRight } from "lucide-react";
import { useLeaderboard } from "@/hooks/useLeaderboard";

interface RankingCardProps {
  userId: string;
  onClick: () => void;
}

export default function RankingCard({ userId, onClick }: RankingCardProps) {
  const { currentUserStats, hasParticipated, isLoading } = useLeaderboard(userId);

  if (isLoading) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
        Ranking
      </p>
      <button
        onClick={onClick}
        className="w-full rounded-2xl border border-border/40 bg-card/30 p-4 flex items-center gap-4 hover:bg-card/50 transition-colors text-left"
      >
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          {hasParticipated && currentUserStats ? (
            <>
              <p className="text-sm font-semibold text-foreground">
                Faturamento: #{currentUserStats.posicao_faturamento ?? "-"} · Constância: #
                {currentUserStats.posicao_constancia ?? "-"}
              </p>
              <p className="text-xs text-muted-foreground">Cidade · estado · global</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">
                Você ainda não está no ranking
              </p>
              <p className="text-xs text-muted-foreground">Registre vendas para entrar</p>
            </>
          )}
        </div>
        <span className="text-xs text-primary inline-flex items-center shrink-0">
          Ver completo <ChevronRight className="w-4 h-4 ml-0.5" />
        </span>
      </button>
    </div>
  );
}
