import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Swords } from "lucide-react";

interface Duel {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: string;
  scheduled_date: string | null;
  goal_amount: number | null;
  stakes_amount: number | null;
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const dateBR = (iso: string | null) => {
  if (!iso) return "a combinar";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return iso;
  }
};

// Lista os duelos X1 EM ANDAMENTO entre usuários (modo espectador). Pra enxergar os
// X1 de outras pessoas precisa da policy "x1 spectator view active" (orbis-x1-visivel.sql).
export function X1Andamento({ onOpen }: { onOpen: () => void }) {
  const [duels, setDuels] = useState<Duel[]>([]);
  const [names, setNames] = useState<Record<string, { nome: string | null; avatar: string | null }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("x1_challenges" as any)
        .select("id, challenger_id, opponent_id, status, scheduled_date, goal_amount, stakes_amount")
        .in("status", ["accepted", "awaiting_result"])
        .order("scheduled_date", { ascending: true })
        .limit(20);
      const list = ((data as any[]) || []) as Duel[];
      const ids = Array.from(new Set(list.flatMap((d) => [d.challenger_id, d.opponent_id])));
      const map: Record<string, { nome: string | null; avatar: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("public_profiles").select("user_id, nickname, avatar_url").in("user_id", ids);
        ((profs as any[]) || []).forEach((p) => (map[p.user_id] = { nome: p.nickname, avatar: p.avatar_url }));
      }
      if (alive) {
        setDuels(list);
        setNames(map);
        setLoading(false);
      }
    })().catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (loading || duels.length === 0) return null;

  const av = (uid: string) => names[uid]?.avatar;
  const nm = (uid: string) => names[uid]?.nome || "Vendedor";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 px-1">
        <Swords className="w-4 h-4 text-amber-400" />
        <p className="text-xs font-bold uppercase tracking-wider text-amber-400">X1 em andamento</p>
      </div>
      <div className="space-y-2">
        {duels.map((d) => (
          <button
            key={d.id}
            onClick={onOpen}
            className="w-full rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                <span className="text-sm font-bold text-foreground truncate">{nm(d.challenger_id)}</span>
                {av(d.challenger_id) ? (
                  <img src={av(d.challenger_id)!} className="w-8 h-8 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground">
                    {nm(d.challenger_id).slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-amber-400 font-black text-xs shrink-0">VS</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {av(d.opponent_id) ? (
                  <img src={av(d.opponent_id)!} className="w-8 h-8 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground">
                    {nm(d.opponent_id).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-bold text-foreground truncate">{nm(d.opponent_id)}</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-1.5">
              {dateBR(d.scheduled_date)}
              {d.goal_amount ? ` · meta ${fmt(d.goal_amount)}` : ""}
              {d.stakes_amount && d.stakes_amount > 0 ? ` · aposta ${fmt(d.stakes_amount)}` : " · amistoso"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
