import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Clock, Zap, Coins } from "lucide-react";
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
  valor_gorjeta: number;
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
        .select("hour_index, hour_label, achieved_amount, valor_dinheiro, valor_cartao, valor_pix, valor_calote, valor_gorjeta")
        .eq("plan_id", plan.id)
        .order("hour_index", { ascending: true });
      if (!cancelled) {
        setBlocks(((data ?? []) as any[]).map((b) => ({
          ...b,
          valor_gorjeta: b.valor_gorjeta || 0,
        })) as Block[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId, date, blocks.length]);

  const totalDay = blocks.reduce((s, b) => s + Number(b.achieved_amount || 0), 0);
  const totalTips = blocks.reduce((s, b) => s + Number(b.valor_gorjeta || 0), 0);
  const activeBlocks = blocks.filter((b) => Number(b.achieved_amount) > 0).length;
  const perHour = activeBlocks > 0 ? totalDay / activeBlocks : 0;
  const perMinute = perHour / 60;
  const maxBlock = Math.max(...blocks.map((b) => Number(b.achieved_amount || 0)), 1);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs text-neutral-400 hover:text-white transition-colors py-1"
      >
        <span className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#F4A100]/10 border border-[#F4A100]/20 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5 text-[#F4A100]" />
          </div>
          <span className="font-semibold text-white">Vendas por hora e por minuto</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4 animate-in fade-in duration-150">
          {loading ? (
            <p className="text-xs text-neutral-500 text-center py-4">Carregando...</p>
          ) : blocks.length === 0 ? (
            <p className="text-xs text-neutral-500 text-center py-4">
              Sem blocos cadastrados nesse dia.
            </p>
          ) : (
            <>
              {/* Resumo: por hora / por minuto */}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#F4A100]/12 to-[#F4A100]/4 border border-[#F4A100]/25 p-3">
                  <div className="absolute -top-6 -right-6 w-14 h-14 rounded-full bg-[#F4A100]/20 blur-2xl pointer-events-none" />
                  <p className="relative text-[10px] uppercase tracking-wider text-[#F4A100] font-semibold">Por hora ativa</p>
                  <p className="relative text-lg font-bold text-white tabular-nums mt-1">
                    {formatCurrency(perHour)}
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#6B21A8]/18 to-[#6B21A8]/5 border border-[#A78BFA]/25 p-3">
                  <div className="absolute -top-6 -right-6 w-14 h-14 rounded-full bg-[#A78BFA]/25 blur-2xl pointer-events-none" />
                  <p className="relative text-[10px] uppercase tracking-wider text-[#A78BFA] font-semibold">Por minuto</p>
                  <p className="relative text-lg font-bold text-white tabular-nums mt-1">
                    {formatCurrency(perMinute)}
                    <span className="text-xs text-neutral-500 font-normal">/min</span>
                  </p>
                </div>
              </div>

              {/* Gorjetas no dia (se houver) */}
              {totalTips > 0 && (
                <div className="rounded-xl bg-gradient-to-r from-[#F4A100]/10 via-[#F4A100]/5 to-transparent border border-[#F4A100]/25 px-3 py-2 flex items-center gap-2.5">
                  <Coins className="w-4 h-4 text-[#F4A100] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-[#F4A100] font-semibold">Gorjetas do dia</p>
                  </div>
                  <p className="text-sm font-bold text-[#F4A100] tabular-nums">+{formatCurrency(totalTips)}</p>
                </div>
              )}

              {/* Lista bloco a bloco com barra visual */}
              <div className="space-y-1.5">
                {blocks.map((b) => {
                  const amount = Number(b.achieved_amount || 0);
                  const tip = Number(b.valor_gorjeta || 0);
                  const minRate = amount / 60;
                  const isActive = amount > 0;
                  const pct = (amount / maxBlock) * 100;
                  return (
                    <div
                      key={b.hour_index}
                      className={`relative overflow-hidden rounded-xl border px-3 py-2.5 transition-colors ${
                        isActive
                          ? "bg-[#0F0F0F] border-white/10"
                          : "bg-black/40 border-white/5"
                      }`}
                    >
                      {/* barra de fundo proporcional */}
                      {isActive && (
                        <div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#F4A100]/10 to-transparent transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Zap
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive ? "text-[#F4A100] fill-[#F4A100]/40" : "text-neutral-700"
                            }`}
                          />
                          <span className={`text-xs font-mono ${isActive ? "text-neutral-300" : "text-neutral-600"}`}>
                            {b.hour_label}
                          </span>
                          {tip > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#F4A100] bg-[#F4A100]/10 border border-[#F4A100]/30 rounded-md px-1.5 py-0.5">
                              <Coins className="w-2.5 h-2.5" />
                              {formatCurrency(tip)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-3 text-right shrink-0">
                          <span className="text-[10px] text-neutral-500 tabular-nums">
                            {formatCurrency(minRate)}<span className="text-[9px]">/min</span>
                          </span>
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              isActive ? "text-white" : "text-neutral-600"
                            }`}
                          >
                            {formatCurrency(amount)}
                          </span>
                        </div>
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
