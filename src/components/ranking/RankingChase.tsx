import { LeaderboardEntry } from "@/hooks/useLeaderboard";
import { cn } from "@/shared/lib/utils";
import { ArrowUp, Crown } from "lucide-react";

interface Props {
  ranking: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  formatCurrency: (v: number) => string;
}

function ChaseAvatar({ url, name, ring }: { url: string | null; name: string | null; ring: string }) {
  const base = cn(
    "w-11 h-11 rounded-full object-cover border-2 flex items-center justify-center font-black shrink-0",
    ring
  );
  if (url) return <img src={url} alt={name || ""} className={base} />;
  return <div className={cn(base, "bg-foreground/10")}>{(name || "U").charAt(0).toUpperCase()}</div>;
}

export function RankingChase({ ranking, me, formatCurrency }: Props) {
  if (!me || !me.posicao_faturamento || ranking.length === 0) return null;
  const myIdx = ranking.findIndex((e) => e.user_id === me.user_id);

  if (myIdx === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/15 to-transparent p-5 text-center">
        <Crown className="w-7 h-7 text-primary mx-auto drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" />
        <p className="text-primary font-black tracking-widest text-sm mt-2">VOCÊ É O LÍDER</p>
        <p className="text-xs text-muted-foreground mt-1">Ninguém na sua frente — defenda o topo!</p>
      </div>
    );
  }
  if (myIdx < 0) return null;

  const ahead = ranking[myIdx - 1];
  const myVal = me.faturamento_total_mes || 0;
  const aheadVal = ahead.faturamento_total_mes || 0;
  const gap = Math.max(0, aheadVal - myVal);
  const pct = aheadVal > 0 ? Math.min(100, Math.round((myVal / aheadVal) * 100)) : 0;
  const colado = pct >= 80;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[11px] tracking-widest text-muted-foreground text-center mb-3">
        A CAÇADA · QUEM ESTÁ NA SUA FRENTE
      </p>

      <div className="flex items-center gap-3">
        <ChaseAvatar url={ahead.avatar_url} name={ahead.nome_usuario} ring="border-foreground/40 text-foreground/80" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">
            {ahead.nome_usuario || "Vendedor"} <span className="text-xs text-muted-foreground">· #{myIdx}</span>
          </p>
          <p className="text-sm font-black text-foreground/80">{formatCurrency(aheadVal)}</p>
        </div>
        <p className="text-sm font-black text-primary flex items-center gap-1 shrink-0">
          <ArrowUp className="w-4 h-4" /> Faltam {formatCurrency(gap)}
        </p>
      </div>

      <div className="h-2.5 rounded-full bg-muted my-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.7)] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center gap-3">
        <ChaseAvatar url={me.avatar_url} name={me.nome_usuario} ring="border-primary text-primary" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">
            Você <span className="text-xs text-muted-foreground">· #{me.posicao_faturamento}</span>
          </p>
          <p className="text-sm font-black text-primary">{formatCurrency(myVal)}</p>
        </div>
        <span className="text-[11px] font-black px-3 py-1.5 rounded-full bg-primary text-primary-foreground shrink-0">
          {colado ? "Ta colado!" : "Bora ultrapassar"}
        </span>
      </div>
    </div>
  );
}
