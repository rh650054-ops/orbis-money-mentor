import { useState } from "react";
import { LeaderboardEntry } from "@/hooks/useLeaderboard";
import { getTier } from "./tier";
import { ChevronRight, ChevronUp } from "lucide-react";

interface Props {
  ranking: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  formatCurrency: (v: number) => string;
  onOpenProfile: (uid: string) => void;
}

function RowAvatar({ url, name, color }: { url: string | null; name: string | null; color: string }) {
  if (url) {
    return <img src={url} alt={name || ""} className="w-9 h-9 rounded-full object-cover border-2 shrink-0" style={{ borderColor: color }} />;
  }
  return (
    <div className="w-9 h-9 rounded-full border-2 bg-[#161616] flex items-center justify-center font-black text-sm shrink-0" style={{ borderColor: color, color }}>
      {(name || "U").charAt(0).toUpperCase()}
    </div>
  );
}

function Divider({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-0.5">
      <div className="flex-1 h-px" style={{ background: color, opacity: 0.25 }} />
      <span className="text-[11px] font-black tracking-[0.15em]" style={{ color }}>{"LIGA " + label}</span>
      <div className="flex-1 h-px" style={{ background: color, opacity: 0.25 }} />
    </div>
  );
}

function Row({ entry, position, isMe, subtitle, formatCurrency, onOpenProfile }: {
  entry: LeaderboardEntry; position: number; isMe: boolean; subtitle: string;
  formatCurrency: (v: number) => string; onOpenProfile: (uid: string) => void;
}) {
  const tier = getTier(position);
  return (
    <button onClick={() => onOpenProfile(entry.user_id)} className="w-full text-left active:scale-[0.99] transition-transform">
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style={isMe ? { background: "#1a1305", border: `1px solid ${tier.color}`, boxShadow: `0 0 14px ${tier.glow}` } : { background: "#0e0e10" }}
      >
        <span className="w-6 text-center font-black shrink-0" style={{ color: tier.color }}>{position}</span>
        <RowAvatar url={entry.avatar_url} name={entry.nome_usuario} color={tier.color} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">
            {entry.nome_usuario || "Vendedor"}
            {isMe && <span className="ml-1.5 align-middle text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: tier.color, color: "#1a1305" }}>VOCÊ</span>}
          </p>
          <p className="text-[10px] truncate" style={{ color: tier.color }}>{subtitle}</p>
        </div>
        <span className="text-white font-black text-sm shrink-0">{formatCurrency(entry.faturamento_total_mes || 0)}</span>
      </div>
    </button>
  );
}

export function RankingList({ ranking, me, formatCurrency, onOpenProfile }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (ranking.length < 4) return null;
  const myIdx = me ? ranking.findIndex((e) => e.user_id === me.user_id) : -1;

  const items = ranking.map((entry, i) => ({ entry, position: i + 1 }));
  const top = items.slice(3, expanded ? items.length : 10);
  const showRegion = !expanded && myIdx >= 10;
  const region = showRegion ? items.slice(Math.max(3, myIdx - 1), myIdx + 2) : [];

  const subtitleFor = (entry: LeaderboardEntry, position: number) => {
    const tier = getTier(position);
    if (me && entry.user_id === me.user_id && position > 1) {
      const ahead = ranking[position - 2];
      const gap = Math.max(0, (ahead?.faturamento_total_mes || 0) - (entry.faturamento_total_mes || 0));
      const nm = ahead?.nome_usuario || "o próximo";
      return `${tier.label} · faltam ${formatCurrency(gap)} pra ${nm}`;
    }
    return tier.label;
  };

  const renderRows = (arr: { entry: LeaderboardEntry; position: number }[], keyp: string) => {
    const out: JSX.Element[] = [];
    let last = "";
    arr.forEach(({ entry, position }) => {
      const tier = getTier(position);
      if (tier.label !== last) {
        out.push(<Divider key={keyp + "d" + position} label={tier.label} color={tier.color} />);
        last = tier.label;
      }
      out.push(
        <Row
          key={keyp + entry.user_id}
          entry={entry}
          position={position}
          isMe={!!me && entry.user_id === me.user_id}
          subtitle={subtitleFor(entry, position)}
          formatCurrency={formatCurrency}
          onOpenProfile={onOpenProfile}
        />
      );
    });
    return out;
  };

  return (
    <div className="space-y-1.5">
      {renderRows(top, "t")}
      {showRegion && (
        <div className="space-y-1.5">
          <div className="text-center text-[#4f4a42] text-base tracking-[0.3em] py-1">⋯</div>
          {renderRows(region, "r")}
        </div>
      )}
      {ranking.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-border/50 text-muted-foreground text-sm mt-1"
        >
          {expanded ? "Mostrar menos" : `Ver ranking completo (${ranking.length} vendedores)`}
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
