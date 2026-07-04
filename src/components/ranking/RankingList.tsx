import { useState, useEffect } from "react";
import { LeaderboardEntry } from "@/hooks/useLeaderboard";
import { getTier } from "./tier";
import { presenceInfo } from "@/shared/lib/presence";
import { avatarThumb } from "@/shared/lib/avatar";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronUp, Swords } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  ranking: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  formatCurrency: (v: number) => string;
  onOpenProfile: (uid: string) => void;
}

// presenceInfo/ONLINE_MS vêm de "@/shared/lib/presence" (compartilhado: pódio, chase, comunidade, perfil).

function RowAvatar({ url, name, color, icon, pres }: {
  url: string | null; name: string | null; color: string; icon: string;
  pres: { online: boolean };
}) {
  const inner = url
    ? <img src={avatarThumb(url, 72)} alt={name || ""} loading="lazy" className="w-9 h-9 rounded-full object-cover border-2" style={{ borderColor: color }} />
    : <img src={icon} alt={name || ""} className="w-9 h-9 object-contain" style={{ filter: `drop-shadow(0 0 5px ${color}99)` }} />;
  return (
    <div className="relative shrink-0">
      {inner}
      {/* Sempre mostra a bolinha: verde = no DEFCON agora, cinza = offline. */}
      <span
        className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
        style={{ borderColor: "#0e0e10", background: pres.online ? "#22c55e" : "#6b7280" }}
      />
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

function Row({ entry, position, isMe, subtitle, suspect, formatCurrency, onOpenProfile }: {
  entry: LeaderboardEntry; position: number; isMe: boolean; subtitle: string; suspect?: string;
  formatCurrency: (v: number) => string; onOpenProfile: (uid: string) => void;
}) {
  const navigate = useNavigate();
  const tier = getTier(position);
  const pres = presenceInfo(entry.last_active_at);
  const sub = !pres.online && pres.label ? `${subtitle} · ${pres.label}` : subtitle;
  return (
    <button onClick={() => onOpenProfile(entry.user_id)} className="w-full text-left active:scale-[0.99] transition-transform">
      <div
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
        style={isMe ? { background: "#1a1305", border: `1px solid ${tier.color}`, boxShadow: `0 0 14px ${tier.glow}` } : { background: "#0e0e10" }}
      >
        <span className="w-6 text-center font-black shrink-0" style={{ color: tier.color }}>{position}</span>
        <RowAvatar url={entry.avatar_url} name={entry.nome_usuario} color={tier.color} icon={tier.icon} pres={pres} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">
            {entry.nome_usuario || "Vendedor"}
            {pres.online && <span className="ml-1.5 align-middle text-[9px] font-black text-green-400">no DEFCON</span>}
            {isMe && <span className="ml-1.5 align-middle text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: tier.color, color: "#1a1305" }}>VOCÊ</span>}
          </p>
          <p className="text-[10px] truncate" style={{ color: tier.color }}>{sub}</p>
        </div>
        {/* Bolinha de SUSPEITA — SÓ o admin recebe dados (a função só retorna pra admin). */}
        {suspect && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); navigate("/admin/anti-trapaca"); }}
            title={`⚠️ Suspeito: ${suspect} — toque pra revisar/remover`}
            className="shrink-0 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center animate-pulse shadow-[0_0_8px_rgba(239,68,68,.7)]"
            aria-label="Suspeito de fraude — abrir anti-trapaça"
          >
            <span className="text-[9px] leading-none">!</span>
          </span>
        )}
        <span className="text-white font-black text-sm shrink-0">{formatCurrency(entry.faturamento_total_mes || 0)}</span>
        {/* DESAFIAR: botão de X1 direto do ranking — vermelho sangue, estilo "apontar o dedo" */}
        {!isMe && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/x1?desafiar=${entry.user_id}`);
            }}
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-transform"
            style={{
              background: "linear-gradient(160deg,#3b0a0a,#1a0505)",
              border: "1px solid rgba(239,68,68,.55)",
              boxShadow: "0 0 10px rgba(239,68,68,.35)",
            }}
            aria-label={`Desafiar ${entry.nome_usuario || "vendedor"} pro X1`}
          >
            <Swords className="w-4 h-4 text-red-500" />
          </span>
        )}
      </div>
    </button>
  );
}

export function RankingList({ ranking, me, formatCurrency, onOpenProfile }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Suspeitos de fraude — a função no banco SÓ devolve dados pra ADMIN, então
  // o usuário comum recebe mapa vazio (nenhuma bolinha aparece pra ele).
  const [suspects, setSuspects] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any).rpc("ranking_suspeitos");
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const r of (data as any[]) || []) map[String(r.user_id)] = String(r.motivo);
      setSuspects(map);
    })().catch(() => {});
    return () => { alive = false; };
  }, []);
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
          suspect={suspects[entry.user_id]}
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
