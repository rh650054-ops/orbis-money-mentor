import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Clock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";

interface Block {
  hour_index: number;
  hour_label: string;
  achieved_amount: number;
  valor_dinheiro: number;
  valor_cartao: number;
  valor_pix: number;
  valor_calote: number;
}

interface Props {
  userId: string;
  date: string; // yyyy-mm-dd
}

export default function HourlyBreakdown({ userId, date }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);

  useEffect(() => {
    if (!open || blocks.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: plan } = await supabase
        .from("daily_goal_plans")
        .select("id")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();
      if (!plan) {
        if (!cancelled) {
          setBlocks([]);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("hourly_goal_blocks")
        .select("hour_index, hour_label, achieved_amount, valor_dinheiro, valor_cartao, valor_pix, valor_calote")
        .eq("plan_id", plan.id)
        .order("hour_index", { ascending: true });
      if (!cancelled) {
        setBlocks((data ?? []) as Block[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId, date, blocks.length]);

  const totalDay = blocks.reduce((s, b) => s + Number(b.achieved_amount || 0), 0);
  const activeBlocks = blocks.filter((b) => Number(b.achieved_amount) > 0).length;
  const perHour = activeBlocks > 0 ? totalDay / activeBlocks : 0;
  const perMinute = perHour / 60;

  return (
    <div className="mt-2 border-t border-white/5 pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#F4A100]" />
          Vendas por hora e por minuto
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3 animate-in fade-in duration-150">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-3">Carregando...</p>
          ) : blocks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              Sem blocos cadastrados nesse dia.
            </p>
          ) : (
            <>
              {/* Resumo por hora / minuto */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[#F4A100]/8 border border-[#F4A100]/20 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-[#F4A100]/80">Por hora ativa</p>
                  <p className="text-base font-bold text-foreground tabular-nums">
                    {formatCurrency(perHour)}
                  </p>
                </div>
                <div className="rounded-lg bg-[#6B21A8]/10 border border-[#6B21A8]/25 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-[#A78BFA]">Por minuto</p>
                  <p className="text-base font-bold text-foreground tabular-nums">
                    {formatCurrency(perMinute)}
                    <span className="text-xs text-muted-foreground font-normal">/min</span>
                  </p>
                </div>
              </div>

              {/* Lista bloco a bloco */}
              <div className="rounded-lg bg-black/30 border border-white/5 divide-y divide-white/5">
                {blocks.map((b) => {
                  const amount = Number(b.achieved_amount || 0);
                  const minRate = amount / 60;
                  const isActive = amount > 0;
                  return (
                    <div
                      key={b.hour_index}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Zap
                          className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[#F4A100]" : "text-neutral-700"}`}
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {b.hour_label}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-3 text-right">
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatCurrency(minRate)}<span className="text-[10px]">/min</span>
                        </span>
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            isActive ? "text-foreground" : "text-neutral-600"
                          }`}
                        >
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
