import { LeaderboardEntry } from "@/hooks/useLeaderboard";
import { getTier } from "./tier";
import { presenceInfo } from "@/shared/lib/presence";
import { avatarThumb } from "@/shared/lib/avatar";
import { Crown } from "lucide-react";

type Variant = "mensal" | "semanal" | "premium";

interface Props {
  top1?: LeaderboardEntry;
  top2?: LeaderboardEntry;
  top3?: LeaderboardEntry;
  formatCurrency: (v: number) => string;
  onOpenProfile: (uid: string) => void;
  variant?: Variant;
}

// Liga Semanal = AMBIENTE verde (fundo + badge). As medalhas continuam ouro/prata/bronze:
// o top1 ganha ESMERALDA no lugar do ouro; top2/top3 mantêm prata/bronze. A base do pódio
// usa a MESMA cor do círculo (medalha) de cada posição.
const EMERALD = "#34D399";
const EMERALD_GLOW = "rgba(52,211,153,0.55)";

function PodAvatar({ url, name, size, color, glow, icon, online }: { url: string | null; name: string | null; size: number; color: string; glow: string; icon: string; online: boolean }) {
  const dot = Math.max(12, Math.round(size * 0.22));
  const inset = Math.round(size * 0.06);
  const img = url ? (
    <img
      src={avatarThumb(url, 192)}
      alt={name || ""}
      className="rounded-full object-cover border-[3px] block"
      style={{ width: size, height: size, borderColor: color, boxShadow: `0 0 ${Math.round(size * 0.5)}px ${glow}` }}
    />
  ) : (
    // Sem foto -> escudo da liga
    <img
      src={icon}
      alt={name || ""}
      className="object-contain block"
      style={{ width: size * 1.12, height: size * 1.12, filter: `drop-shadow(0 0 ${Math.round(size * 0.3)}px ${glow})` }}
    />
  );
  return (
    <div className="relative inline-block">
      {img}
      {/* Bolinha: verde = no DEFCON agora, cinza = offline (igual nas redes sociais). */}
      <span
        className="absolute rounded-full border-2"
        style={{ width: dot, height: dot, bottom: inset, right: inset, borderColor: "#0a0a0d", background: online ? "#22c55e" : "#6b7280" }}
      />
    </div>
  );
}

function Col({ entry, position, avatarSize, barHeight, champion, green, formatCurrency, onOpenProfile }: {
  entry?: LeaderboardEntry; position: number; avatarSize: number; barHeight: number; champion?: boolean; green?: boolean;
  formatCurrency: (v: number) => string; onOpenProfile: (uid: string) => void;
}) {
  if (!entry) return <div className="flex-1" />;
  const tier = getTier(position);
  const online = presenceInfo(entry.last_active_at).online;
  const medal = position === 2 ? "🥈" : position === 3 ? "🥉" : "";

  // Borda do avatar: no verde o top1 vira esmeralda; top2/top3 mantêm prata/bronze (tier).
  const avatarColor = green && position === 1 ? EMERALD : tier.color;
  const avatarGlow = green && position === 1 ? EMERALD_GLOW : tier.glow;
  // Base do pódio = MESMA cor do círculo/medalha (top1 esmeralda, top2 prata, top3 bronze).
  const baseColor = avatarColor;
  const baseGlow = avatarGlow;

  return (
    <div className="flex-1 text-center min-w-0">
      {champion ? (
        // Coroa SEMPRE dourada (assinatura do Orbis); só o glow acompanha o ambiente.
        <Crown className="w-8 h-8 mx-auto mb-1" style={{ color: "#F5D77A", filter: `drop-shadow(0 0 14px ${avatarGlow})` }} />
      ) : (
        <div className="text-[20px] leading-none mb-1" style={{ filter: `drop-shadow(0 0 8px ${tier.glow})` }}>{medal}</div>
      )}
      <button onClick={() => onOpenProfile(entry.user_id)} className="block w-full active:scale-[0.97] transition-transform">
        <div className="flex items-center justify-center" style={{ height: avatarSize * 1.12 }}>
          <PodAvatar url={entry.avatar_url} name={entry.nome_usuario} size={avatarSize} color={avatarColor} glow={avatarGlow} icon={tier.icon} online={online} />
        </div>
        <p className="text-[13px] font-black mt-2 truncate px-0.5" style={{ color: avatarColor }}>{entry.nome_usuario || "Vendedor"}</p>
        <p className="text-white text-[14px] font-black">{formatCurrency(entry.faturamento_total_mes || 0)}</p>
        <p className="text-[10px] font-black tracking-wider" style={{ color: avatarColor }}>{tier.label}</p>
      </button>
      <div
        className="mt-2 rounded-t-xl flex items-center justify-center font-black relative overflow-hidden"
        style={{
          height: barHeight,
          fontSize: champion ? 30 : 22,
          color: "#ffffff",
          background: `linear-gradient(180deg, ${baseColor}${green ? "55" : "40"} 0%, ${green ? "#07130d" : "#101015"} 88%)`,
          border: `1px solid ${baseColor}66`,
          borderBottom: "none",
          boxShadow: `inset 0 1px 0 ${baseColor}66`,
        }}
      >
        <span style={{ textShadow: `0 0 16px ${baseGlow}` }}>{position}</span>
      </div>
    </div>
  );
}

export function RankingPodium({ top1, top2, top3, formatCurrency, onOpenProfile, variant = "mensal" }: Props) {
  if (!top1) return null;
  const green = variant === "semanal";
  const premium = variant === "premium";
  const label = premium ? "PÓDIO DA COMPETIÇÃO" : green ? "PÓDIO DA SEMANA" : "PÓDIO DO MÊS";
  const labelColor = premium ? "#F5D77A" : green ? "#6EE7B7" : "#C9A6FF";
  const bg = premium
    ? "radial-gradient(120% 70% at 50% 0%, rgba(245,181,68,0.20) 0%, #120d04 62%)"
    : green
      ? "radial-gradient(120% 70% at 50% 0%, rgba(16,185,129,0.18) 0%, #06120d 62%)"
      : "radial-gradient(120% 70% at 50% 0%, rgba(176,124,240,0.16) 0%, #0a0a0d 62%)";
  return (
    <div
      className="rounded-2xl border p-4 pt-3"
      style={{
        borderColor: premium ? "#3a2c0a" : green ? "#11352a" : "#26262e",
        background: bg,
      }}
    >
      <p className="text-center tracking-[0.3em] text-[11px] mb-3" style={{ color: labelColor }}>
        {label}
      </p>
      <div className="flex items-end justify-center gap-2">
        <Col entry={top2} position={2} avatarSize={56} barHeight={72} green={green} formatCurrency={formatCurrency} onOpenProfile={onOpenProfile} />
        <Col entry={top1} position={1} avatarSize={80} barHeight={106} champion green={green} formatCurrency={formatCurrency} onOpenProfile={onOpenProfile} />
        <Col entry={top3} position={3} avatarSize={52} barHeight={56} green={green} formatCurrency={formatCurrency} onOpenProfile={onOpenProfile} />
      </div>
    </div>
  );
}
