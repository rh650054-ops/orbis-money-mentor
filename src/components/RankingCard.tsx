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
        className="group relative w-full overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.06] via-card/60 to-card/30 p-4 flex items-center gap-4 hover:border-primary/40 transition-all text-left"
        style={{
          boxShadow:
            "0 4px 20px -8px hsl(var(--primary) / 0.25), inset 0 1px 0 hsl(var(--primary) / 0.08)",
        }}
      >
        {/* Subtle shine sweep */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div
            className="absolute -top-1/2 -left-1/4 h-[200%] w-1/4 animate-shine-sweep opacity-60"
            style={{
              background:
                "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.10), transparent)",
            }}
          />
        </div>

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
