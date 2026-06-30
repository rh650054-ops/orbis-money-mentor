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

  const accent = "#F5B544"; // dourado = competição
  const glow = "rgba(245,181,68,0.45)";

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Competição</p>
      <button
        onClick={onClick}
        className="group relative w-full overflow-hidden rounded-2xl border p-4 flex items-center gap-4 text-left transition-transform active:scale-[0.99]"
        style={{
          borderColor: x1Pending > 0 ? "#ef444466" : `${accent}44`,
          background: `linear-gradient(135deg, ${accent}14 0%, rgba(12,12,15,0.6) 55%)`,
          boxShadow: `0 6px 24px -10px ${glow}, inset 0 1px 0 ${accent}22`,
        }}
      >
        {x1Pending > 0 && (
          <span className="absolute top-2 right-2 z-10 min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shadow-md">
            {x1Pending}
          </span>
        )}
        <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: `${accent}1f`, border: `2px solid ${accent}`, color: accent, boxShadow: `0 0 18px -2px ${glow}` }}
          >
            <Swords className="w-5 h-5" />
          </div>
        </div>
        <div className="relative flex-1 min-w-0">
          {activeCount === null ? (
            <>
              <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-24 rounded bg-white/5 animate-pulse mt-1.5" />
            </>
          ) : activeCount > 0 ? (
            <>
              <p className="text-sm font-bold text-foreground">
                {activeCount} competiç{activeCount === 1 ? "ão" : "ões"} ativa{activeCount === 1 ? "" : "s"}
              </p>
              {x1Pending > 0 ? (
                <p className="text-xs font-bold text-red-400">
                  ⚔️ {x1Pending} X1 te esperando!
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {joinedCount > 0 ? `Você está em ${joinedCount} · veja o ranking` : "Entre e dispute prêmios 🏆"}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Competições</p>
              {x1Pending > 0 ? (
                <p className="text-xs font-bold text-red-400">
                  ⚔️ {x1Pending} X1 te esperando!
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Em breve — fique de olho 🏆</p>
              )}
            </>
          )}
        </div>
        <span
          className="relative text-xs inline-flex items-center shrink-0 group-hover:translate-x-0.5 transition-transform"
          style={{ color: accent }}
        >
          Ver <ChevronRight className="w-4 h-4 ml-0.5" />
        </span>
      </button>
    </div>
  );
}
