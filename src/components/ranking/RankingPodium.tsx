import { LeaderboardEntry } from "@/hooks/useLeaderboard";
import { getTier } from "./tier";
import { Crown } from "lucide-react";

interface Props {
  top1?: LeaderboardEntry;
  top2?: LeaderboardEntry;
  top3?: LeaderboardEntry;
  formatCurrency: (v: number) => string;
  onOpenProfile: (uid: string) => void;
}

function PodAvatar({ url, name, size, color, glow, icon }: { url: string | null; name: string | null; size: number; color: string; glow: string; icon: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name || ""}
        className="rounded-full object-cover border-[3px] mx-auto block"
        style={{ width: size, height: size, borderColor: color, boxShadow: `0 0 ${Math.round(size * 0.5)}px ${glow}` }}
      />
    );
  }
  // Sem foto -> escudo da liga
  return (
    <img
      src={icon}
      alt={name || ""}
      className="object-contain mx-auto block"
      style={{ width: size * 1.12, height: size * 1.12, filter: `drop-shadow(0 0 ${Math.round(size * 0.3)}px ${glow})` }}
    />
  );
}

function Col({ entry, position, avatarSize, barHeight, champion, formatCurrency, onOpenProfile }: {
  entry?: LeaderboardEntry; position: number; avatarSize: number; barHeight: number; champion?: boolean;
  formatCurrency: (v: number) => string; onOpenProfile: (uid: string) => void;
}) {
  if (!entry) return <div className="flex-1" />;
  const tier = getTier(position);
  const medal = position === 2 ? "🥈" : position === 3 ? "🥉" : "";
  return (
    <div className="flex-1 text-center min-w-0">
      {champion ? (
        <Crown className="w-8 h-8 mx-auto mb-1" style={{ color: "#F5D77A", filter: `drop-shadow(0 0 14px ${tier.glow})` }} />
      ) : (
        <div className="text-[20px] leading-none mb-1" style={{ filter: `drop-shadow(0 0 8px ${tier.glow})` }}>{medal}</div>
      )}
      <button onClick={() => onOpenProfile(entry.user_id)} className="block w-full active:scale-[0.97] transition-transform">
        <div className="flex items-center justify-center" style={{ height: avatarSize * 1.12 }}>
          <PodAvatar url={entry.avatar_url} name={entry.nome_usuario} size={avatarSize} color={tier.color} glow={tier.glow} icon={tier.icon} />
        </div>
        <p className="text-[13px] font-black mt-2 truncate px-0.5" style={{ color: tier.color }}>{entry.nome_usuario || "Vendedor"}</p>
        <p className="text-white text-[14px] font-black">{formatCurrency(entry.faturamento_total_mes || 0)}</p>
        <p className="text-[10px] font-black tracking-wider" style={{ color: tier.color }}>{tier.label}</p>
      </button>
      <div
        className="mt-2 rounded-t-xl flex items-center justify-center font-black relative overflow-hidden"
        style={{
          height: barHeight,
          fontSize: champion ? 30 : 22,
          color: "#ffffff",
          background: `linear-gradient(180deg, ${tier.color}40 0%, #101015 88%)`,
          border: `1px solid ${tier.color}66`,
          borderBottom: "none",
          boxShadow: `inset 0 1px 0 ${tier.color}66`,
        }}
      >
        <span style={{ textShadow: `0 0 16px ${tier.glow}` }}>{position}</span>
      </div>
    </div>
  );
}

export function RankingPodium({ top1, top2, top3, formatCurrency, onOpenProfile }: Props) {
  if (!top1) return null;
  return (
    <div className="rounded-2xl border border-[#26262e] p-4 pt-3" style={{ background: "radial-gradient(120% 70% at 50% 0%, rgba(176,124,240,0.16) 0%, #0a0a0d 62%)" }}>
      <p className="text-center tracking-[0.3em] text-[11px] mb-3" style={{ color: "#C9A6FF" }}>PÓDIO DO MÊS</p>
      <div className="flex items-end justify-center gap-2">
        <Col entry={top2} position={2} avatarSize={56} barHeight={72} formatCurrency={formatCurrency} onOpenProfile={onOpenProfile} />
        <Col entry={top1} position={1} avatarSize={80} barHeight={106} champion formatCurrency={formatCurrency} onOpenProfile={onOpenProfile} />
        <Col entry={top3} position={3} avatarSize={52} barHeight={56} formatCurrency={formatCurrency} onOpenProfile={onOpenProfile} />
      </div>
    </div>
  );
}
