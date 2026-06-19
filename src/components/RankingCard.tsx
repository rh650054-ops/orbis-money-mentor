import { Trophy, ChevronRight, Flame } from "lucide-react";
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
  const accent = tier?.color ?? "#B47CFF";
  const glow = tier?.glow ?? "rgba(176,124,240,0.5)";
  const loadingStats = isLoading && !currentUserStats;

  // Enquanto carrega, mostra um esqueleto cinza neutro — evita o card aparecer
  // ROXO (cor padrão) e depois trocar pra cor real da liga.
  if (loadingStats) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Ranking</p>
        <div className="w-full rounded-2xl border border-border bg-card/40 p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Ranking</p>
      <button
        onClick={onClick}
        className="group relative w-full overflow-hidden rounded-2xl border p-4 flex items-center gap-4 text-left transition-transform active:scale-[0.99]"
        style={{
          borderColor: `${accent}44`,
          background: `linear-gradient(135deg, ${accent}14 0%, rgba(12,12,15,0.6) 55%)`,
          boxShadow: `0 6px 24px -10px ${glow}, inset 0 1px 0 ${accent}22`,
        }}
      >
        <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
          {tier ? (
            <img src={tier.icon} alt={tier.label} className="w-14 h-14 object-contain" style={{ filter: `drop-shadow(0 0 9px ${glow})` }} />
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${accent}1f`, border: `2px solid ${accent}`, color: accent, boxShadow: `0 0 18px -2px ${glow}` }}>
              <Trophy className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="relative flex-1 min-w-0">
          {loadingStats ? (
            <>
              <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-24 rounded bg-white/5 animate-pulse mt-1.5" />
            </>
          ) : inRank ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black tracking-wider px-1.5 py-0.5 rounded" style={{ color: accent, background: `${accent}1f` }}>
                  {tier!.label}
                </span>
                {!!currentUserStats!.constancia_streak_atual && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-black" style={{ color: accent }}>
                    <Flame className="w-3 h-3" /> {currentUserStats!.constancia_streak_atual}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-foreground mt-0.5 truncate">Top {pos} vendedor</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Entre no ranking</p>
              <p className="text-xs text-muted-foreground">Registre vendas e dispute o pódio 🏆</p>
            </>
          )}
        </div>
        <span className="relative text-xs inline-flex items-center shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color: accent }}>
          Ver <ChevronRight className="w-4 h-4 ml-0.5" />
        </span>
      </button>
    </div>
  );
}
