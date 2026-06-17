import { ReactNode } from "react";
import { LeaderboardEntry } from "@/hooks/useLeaderboard";
import { getTier } from "./tier";
import { useNavigate } from "react-router-dom";
import { Zap, Crown, Swords, TrendingUp, Clock, Target } from "lucide-react";

interface Props {
  ranking: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  formatCurrency: (v: number) => string;
}

function DuelAvatar({ url, name, color, glow }: { url: string | null; name: string | null; color: string; glow: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name || ""}
        className="w-[78px] h-[78px] rounded-full object-cover border-[3px] mx-auto block"
        style={{ borderColor: color, boxShadow: `0 0 30px ${glow}` }}
      />
    );
  }
  return (
    <div
      className="w-[78px] h-[78px] rounded-full border-[3px] bg-[#161616] flex items-center justify-center text-3xl font-black mx-auto"
      style={{ borderColor: color, boxShadow: `0 0 30px ${glow}`, color }}
    >
      {(name || "U").charAt(0).toUpperCase()}
    </div>
  );
}

function DuelSide({
  entry,
  position,
  tag,
  tagColor,
  formatCurrency,
}: {
  entry: LeaderboardEntry;
  position: number;
  tag: string;
  tagColor: string;
  formatCurrency: (v: number) => string;
}) {
  const tier = getTier(position);
  return (
    <div className="text-center flex-1 min-w-0">
      <div className="relative w-[78px] mx-auto">
        <span
          className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider whitespace-nowrap"
          style={{ background: tagColor }}
        >
          {tag}
        </span>
        <DuelAvatar url={entry.avatar_url} name={entry.nome_usuario} color={tier.color} glow={tier.glow} />
      </div>
      <p className="text-[14px] font-black mt-2 truncate px-1" style={{ color: tier.color }}>
        {entry.nome_usuario || "Vendedor"}
      </p>
      <p className="text-[11px] text-muted-foreground">
        #{position} · <span className="font-black tracking-wider" style={{ color: tier.color }}>{tier.label}</span>
      </p>
      <p className="text-white text-[15px] font-black mt-0.5">{formatCurrency(entry.faturamento_total_mes || 0)}</p>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="bg-[#100f0a] border border-[#241f12] rounded-xl py-2.5 px-1.5 text-center">
      <div className="flex justify-center">{icon}</div>
      <div className="text-white text-sm font-black mt-1 truncate">{value}</div>
      <div className="text-[#6f6a60] text-[10px] leading-tight">{label}</div>
    </div>
  );
}

export function RankingChase({ ranking, me, formatCurrency }: Props) {
  const navigate = useNavigate();
  if (!me || !me.posicao_faturamento || ranking.length === 0) return null;
  const myIdx = ranking.findIndex((e) => e.user_id === me.user_id);

  if (myIdx === 0) {
    const tier = getTier(1);
    return (
      <div
        className="rounded-2xl border border-primary/40 p-5 text-center"
        style={{ background: "radial-gradient(130% 80% at 50% 0%, hsl(45 100% 48% / 0.18) 0%, transparent 65%)" }}
      >
        <Crown className="w-8 h-8 mx-auto" style={{ color: tier.color, filter: `drop-shadow(0 0 16px ${tier.glow})` }} />
        <p className="font-black tracking-[0.2em] text-sm mt-2" style={{ color: tier.color }}>VOCÊ É O LÍDER · {tier.label}</p>
        <p className="text-xs text-muted-foreground mt-1">Tem gente vindo atrás — defenda o topo!</p>
        <button
          onClick={() => navigate("/daily-goals")}
          className="mt-3 inline-flex items-center gap-2 bg-primary text-primary-foreground font-black text-sm px-5 py-2.5 rounded-xl active:scale-[0.98] transition-transform"
        >
          <Swords className="w-4 h-4" /> ABRIR VANTAGEM
        </button>
      </div>
    );
  }
  if (myIdx < 0) return null;

  const ahead = ranking[myIdx - 1];
  if (!ahead) return null;
  const myVal = me.faturamento_total_mes || 0;
  const aheadVal = ahead.faturamento_total_mes || 0;
  const gap = Math.max(0, aheadVal - myVal);
  const pct = aheadVal > 0 ? Math.min(100, Math.round((myVal / aheadVal) * 100)) : 0;

  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, lastDay - now.getDate() + 1);
  const daysWorked = Math.max(1, (me as any).dias_trabalhados_mes || 1);
  const pace = myVal / daysWorked;
  const daysToPass = pace > 0 ? Math.ceil(gap / pace) : 999;
  const ritmoText = gap === 0 ? "agora" : daysToPass <= 1 ? "hoje" : `${daysToPass} dias`;
  const ritmoOk = daysToPass <= daysLeft;
  const perDay = Math.ceil(gap / daysLeft);

  return (
    <div
      className="rounded-2xl overflow-hidden border border-[#2a2410] p-4"
      style={{ background: "radial-gradient(130% 80% at 50% 12%, #2e2408 0%, #070707 62%)" }}
    >
      <p className="text-center text-primary tracking-[0.3em] text-[11px]">PRÓXIMO ALVO · ULTRAPASSAGEM</p>

      <div className="flex items-start justify-center gap-2 mt-5">
        <DuelSide entry={me} position={me.posicao_faturamento} tag="VOCÊ" tagColor="#2e7d32" formatCurrency={formatCurrency} />
        <div className="text-center w-[54px] shrink-0 pt-6">
          <p className="text-2xl font-black text-white leading-none">VS</p>
          <Zap className="w-5 h-5 text-primary mx-auto mt-1" />
        </div>
        <DuelSide entry={ahead} position={myIdx} tag="ALVO" tagColor="#e24b4a" formatCurrency={formatCurrency} />
      </div>

      <div className="text-center mt-4">
        <p className="text-[10px] tracking-[0.3em] text-muted-foreground">FALTAM PARA ULTRAPASSAR</p>
        <p className="text-[34px] leading-tight font-black text-primary" style={{ textShadow: "0 0 26px hsl(var(--primary)/0.65)" }}>
          {formatCurrency(gap)}
        </p>
      </div>

      <div className="h-2.5 rounded-full bg-[#1a1712] overflow-hidden mt-1.5">
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.7)] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <Stat
          icon={<TrendingUp className={"w-4 h-4 " + (ritmoOk ? "text-emerald-400" : "text-amber-400")} />}
          value={ritmoText}
          label="no seu ritmo"
        />
        <Stat icon={<Target className="w-4 h-4 text-primary" />} value={formatCurrency(perDay)} label="por dia pra passar" />
        <Stat icon={<Clock className="w-4 h-4 text-amber-400" />} value={`${daysLeft}`} label="dias no mês" />
      </div>

      <button
        onClick={() => navigate("/daily-goals")}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black text-sm py-3 rounded-xl active:scale-[0.98] transition-transform"
      >
        <Swords className="w-4 h-4" /> ATACAR — IR VENDER
      </button>
    </div>
  );
}
