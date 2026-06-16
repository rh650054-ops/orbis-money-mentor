import { ReactNode } from "react";
import { LeaderboardEntry } from "@/hooks/useLeaderboard";
import { useNavigate } from "react-router-dom";
import { Zap, Crown, Swords, TrendingUp, Clock, Target } from "lucide-react";

interface Props {
  ranking: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  formatCurrency: (v: number) => string;
}

function DuelAvatar({ url, name, color, glow }: { url: string | null; name: string | null; color: string; glow: string }) {
  const style = { borderColor: color, boxShadow: `0 0 30px ${glow}`, color };
  if (url) {
    return <img src={url} alt={name || ""} className="w-[78px] h-[78px] rounded-full object-cover border-[3px]" style={{ borderColor: color, boxShadow: `0 0 30px ${glow}` }} />;
  }
  return (
    <div className="w-[78px] h-[78px] rounded-full border-[3px] bg-[#161616] flex items-center justify-center text-3xl font-black" style={style}>
      {(name || "U").charAt(0).toUpperCase()}
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
    return (
      <div
        className="rounded-2xl border border-primary/40 p-5 text-center"
        style={{ background: "radial-gradient(130% 80% at 50% 0%, hsl(45 100% 48% / 0.18) 0%, transparent 65%)" }}
      >
        <Crown className="w-8 h-8 text-primary mx-auto drop-shadow-[0_0_16px_hsl(var(--primary)/0.7)]" />
        <p className="text-primary font-black tracking-[0.2em] text-sm mt-2">VOCÊ É O LÍDER</p>
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

      <div className="flex items-center justify-center gap-2 mt-4">
        <div className="text-center flex-1 min-w-0">
          <DuelAvatar url={me.avatar_url} name={me.nome_usuario} color="#f5b833" glow="rgba(245,184,51,0.6)" />
          <p className="text-white text-[13px] mt-2">VOCÊ <span className="text-muted-foreground">#{me.posicao_faturamento}</span></p>
          <p className="text-primary text-[15px] font-black">{formatCurrency(myVal)}</p>
        </div>

        <div className="text-center w-[54px] shrink-0">
          <p className="text-2xl font-black text-white">VS</p>
          <Zap className="w-5 h-5 text-primary mx-auto" />
        </div>

        <div className="text-center flex-1 min-w-0">
          <div className="relative w-[78px] mx-auto">
            <span className="absolute -top-1.5 -right-0.5 z-10 text-white text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider" style={{ background: "#e24b4a" }}>ALVO</span>
            <DuelAvatar url={ahead.avatar_url} name={ahead.nome_usuario} color="#c8ccd2" glow="rgba(200,204,210,0.3)" />
          </div>
          <p className="text-white text-[13px] mt-2 truncate">{ahead.nome_usuario || "Rival"} <span className="text-muted-foreground">#{myIdx}</span></p>
          <p className="text-[#c8ccd2] text-[15px] font-black">{formatCurrency(aheadVal)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
          <span>seu avanço</span>
          <span className="text-primary font-black">faltam {formatCurrency(gap)}</span>
        </div>
        <div className="h-2.5 rounded-full bg-[#1a1712] overflow-hidden">
          <div
            className="h-full rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.7)] transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3.5">
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
        className="mt-3.5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black text-sm py-3 rounded-xl active:scale-[0.98] transition-transform"
      >
        <Swords className="w-4 h-4" /> ATACAR — IR VENDER
      </button>
    </div>
  );
}
