import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Swords, ChevronRight } from "lucide-react";

interface Props {
  userId: string;
  onClick: () => void;
}

// Bloco "Competição" na dashboard (abaixo do RankingCard). Leva pra /competitions.
export default function CompetitionCard({ userId, onClick }: Props) {
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [joinedCount, setJoinedCount] = useState(0);
  const [x1Pending, setX1Pending] = useState(0); // convites X1 esperando MINHA resposta

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ count: active }, { data: mine }, { data: x1 }] = await Promise.all([
        supabase.from("competitions" as any).select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("competition_participants" as any).select("competition_id").eq("user_id", userId),
        supabase
          .from("x1_challenges" as any)
          .select("id, last_proposed_by")
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .eq("status", "pending"),
      ]);
      if (!alive) return;
      setActiveCount(active ?? 0);
      setJoinedCount(((mine as any[]) || []).length);
      // Minha vez de responder = a última proposta não foi minha.
      setX1Pending(((x1 as any[]) || []).filter((c) => c.last_proposed_by !== userId).length);
    })().catch(() => {
      if (alive) setActiveCount(0);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-card px-4 py-3.5 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
        <Swords className="w-4 h-4 text-muted-foreground" />
        {x1Pending > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
            {x1Pending}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Competição</p>
        {activeCount === null ? (
          <div className="h-3 w-24 rounded bg-muted animate-pulse mt-1" />
        ) : x1Pending > 0 ? (
          <p className="text-xs text-destructive">{x1Pending} X1 te esperando</p>
        ) : activeCount > 0 ? (
          <p className="text-xs text-muted-foreground truncate">
            {activeCount} ativa{activeCount === 1 ? "" : "s"}
            {joinedCount > 0 ? ` · você está em ${joinedCount}` : ""}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Em breve</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
