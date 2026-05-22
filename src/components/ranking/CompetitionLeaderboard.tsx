import { Crown, Medal, Flame, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Competition, CompetitionParticipant } from "@/hooks/useCompetitions";

interface Props {
  competition: Competition;
  participants: CompetitionParticipant[];
  currentUserId: string | undefined;
}

function formatScore(score: number, metric: Competition["metric"]) {
  if (metric === "pix_revenue") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(score);
  }
  if (metric === "pix_sales_count") return `${score} vendas`;
  return `${score} dias 🔥`;
}

export default function CompetitionLeaderboard({ competition, participants, currentUserId }: Props) {
  if (!participants.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/40 bg-background/30 p-4 text-center">
        <p className="text-xs text-muted-foreground">Ninguém entrou ainda. Seja o primeiro!</p>
      </div>
    );
  }

  const top = participants.slice(0, 10);
  const myIdx = participants.findIndex((p) => p.user_id === currentUserId);
  const showMeBelow = myIdx >= 10;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 mb-1.5">
        <TrendingUp className="w-3.5 h-3.5 text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/85">
          Placar ao vivo
        </p>
      </div>

      {top.map((p, idx) => {
        const pos = idx + 1;
        const isMe = p.user_id === currentUserId;
        return (
          <Row key={p.id} pos={pos} p={p} isMe={isMe} metric={competition.metric} />
        );
      })}

      {showMeBelow && (
        <>
          <div className="text-center text-[10px] text-muted-foreground py-1">⋯</div>
          <Row
            pos={myIdx + 1}
            p={participants[myIdx]}
            isMe
            metric={competition.metric}
          />
        </>
      )}
    </div>
  );
}

function Row({
  pos,
  p,
  isMe,
  metric,
}: {
  pos: number;
  p: CompetitionParticipant;
  isMe: boolean;
  metric: Competition["metric"];
}) {
  const podiumIcon = pos === 1 ? <Crown className="w-3.5 h-3.5 text-primary" /> : pos === 2 ? <Medal className="w-3.5 h-3.5 text-foreground/70" /> : pos === 3 ? <Medal className="w-3.5 h-3.5 text-amber-700" /> : null;
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors",
        isMe
          ? "bg-primary/15 border-primary/50"
          : pos <= 3
          ? "bg-primary/5 border-primary/20"
          : "bg-background/40 border-border/30",
      )}
    >
      <div
        className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black shrink-0",
          isMe ? "bg-primary text-primary-foreground" : "bg-card/60 border border-border/40 text-foreground/80",
        )}
      >
        {pos}
      </div>
      {p.avatar_url ? (
        <img src={p.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-card border border-border/40 flex items-center justify-center text-[11px] font-bold text-foreground/70 shrink-0">
          {(p.nickname || "?").charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-xs font-bold truncate", isMe ? "text-foreground" : "text-foreground/85")}>
          {isMe ? "Você" : p.nickname || "Vendedor"}
          {p.city && <span className="text-[10px] text-muted-foreground font-normal"> · {p.city}</span>}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {podiumIcon}
        <span className={cn("text-xs font-black tabular-nums", isMe ? "text-primary" : "text-foreground/90")}>
          {formatScore(Number(p.score), metric)}
        </span>
      </div>
    </div>
  );
}
