import { useEffect, useState } from "react";
import { Trophy, ChevronRight, Flame } from "lucide-react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { getTier } from "@/components/ranking/tier";

interface RankingCardProps {
  userId: string;
  onClick: () => void;
}

/**
 * Card do Ranking no dashboard — card GRANDE com a IMAGEM da patente do usuário
 * (tier.icon), na cor da liga dele. Novidade v8: quando a patente MUDA (subiu de
 * liga), o card pulsa com brilho na cor da liga nova (animação de vitória do
 * orbis.css) convidando o clique. A última patente vista fica no localStorage
 * por usuário — o pulso só acontece uma vez por mudança.
 */
export default function RankingCard({ userId, onClick }: RankingCardProps) {
  const { currentUserStats, hasParticipated, isLoading } = useLeaderboard(userId);

  const pos = currentUserStats?.posicao_faturamento ?? null;
  const inRank = hasParticipated && !!currentUserStats && !!pos;
  const tier = inRank ? getTier(pos as number) : null;
  const accent = tier?.color ?? "#B47CFF";
  const glow = tier?.glow ?? "rgba(176,124,240,0.5)";
  const loadingStats = isLoading && !currentUserStats;

  // Subiu (ou mudou) de patente? Pulsa na cor da liga nova.
  const [celebrar, setCelebrar] = useState(false);
  useEffect(() => {
    if (!tier?.label || !userId) return;
    try {
      const key = `orbis_patente_vista_${userId}`;
      const antes = localStorage.getItem(key);
      if (antes && antes !== tier.label) setCelebrar(true);
      localStorage.setItem(key, tier.label);
    } catch { /* localStorage indisponível: sem pulso, sem quebra */ }
  }, [tier?.label, userId]);

  if (loadingStats) {
    return (
      <div className="space-y-2">
        <p className="orbis-section px-1">Ranking</p>
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
      <p className="orbis-section px-1">Ranking</p>
      <button
        onClick={onClick}
        className={`orbis-press group relative w-full overflow-hidden rounded-2xl border p-4 flex items-center gap-4 text-left ${celebrar ? "orbis-victory" : ""}`}
        style={{
          borderColor: `${accent}44`,
          background: `linear-gradient(135deg, ${accent}14 0%, rgba(8,8,8,0.6) 55%)`,
          boxShadow: `0 6px 24px -10px ${glow}, inset 0 1px 0 ${accent}22`,
          ["--win-color" as never]: glow,
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
          {inRank ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black tracking-wider px-1.5 py-0.5 rounded" style={{ color: accent, background: `${accent}1f` }}>
                  {tier!.label}
                </span>
                {/* Foguinho = dias de Modo Foco no mês */}
                {!!currentUserStats!.dias_trabalhados_mes && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[11px] font-black"
                    style={{ color: accent }}
                    title={`${currentUserStats!.dias_trabalhados_mes} ${currentUserStats!.dias_trabalhados_mes === 1 ? "dia" : "dias"} de Modo Foco este mês`}
                  >
                    <Flame className="w-3 h-3" /> {currentUserStats!.dias_trabalhados_mes}
                  </span>
                )}
              </div>
              <p className="font-display text-sm font-extrabold text-foreground mt-0.5 truncate">
                {celebrar ? "Você subiu de patente! 🏆" : `Top ${pos} vendedor`}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Entre no ranking</p>
              <p className="text-xs text-muted-foreground">Registre vendas e dispute o pódio</p>
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
