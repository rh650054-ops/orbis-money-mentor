import { Trophy, ChevronRight } from "lucide-react";
import { useLeaderboard } from "@/hooks/useLeaderboard";

interface RankingCardProps {
  userId: string;
  onClick: () => void;
}

export default function RankingCard({ userId, onClick }: RankingCardProps) {
  const { currentUserStats, hasParticipated, isLoading } = useLeaderboard(userId);

  // Esqueleto enquanto carrega — evita o bloco "sumir" e aparecer de repente (layout shift)
  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          Ranking
        </p>
        <div className="w-full rounded-2xl border border-primary/15 bg-card/40 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
        Ranking
      </p>
      <button
        onClick={onClick}
        className="group relative w-full overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.06] via-card/60 to-card/30 p-4 flex items-center gap-4 hover:border-primary/40 transition-[colors,transform,opacity] text-left"
        style={{
          boxShadow:
            "0 4px 20px -8px hsl(var(--primary) / 0.25), inset 0 1px 0 hsl(var(--primary) / 0.08)",
        }}
      >
        <div
          className="relative w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0"
          style={{ boxShadow: "0 0 16px -4px hsl(var(--primary) / 0.5)" }}
        >
          <Trophy className="w-5 h-5 text-primary" />
        </div>
        <div className="relative flex-1 min-w-0">
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
        <span className="relative text-xs text-primary inline-flex items-center shrink-0 group-hover:translate-x-0.5 transition-transform">
          Ver completo <ChevronRight className="w-4 h-4 ml-0.5" />
        </span>
      </button>
    </div>
  );
}
