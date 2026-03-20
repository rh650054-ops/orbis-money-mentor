import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";

interface SmartNotification {
  id: string;
  icon: string;
  message: string;
  timestamp: number;
}

interface DefconSmartNotificationProps {
  userId: string;
  totalApproaches: number;
  totalSalesCount: number;
  blockApproaches: number;
  blockSalesCount: number;
  phase: string;
  currentBlockIndex: number;
}

const DEFAULT_BENCHMARK = 8; // 1 sale per 8 approaches for new users

export function DefconSmartNotification({
  userId,
  totalApproaches,
  totalSalesCount,
  blockApproaches,
  blockSalesCount,
  phase,
  currentBlockIndex,
}: DefconSmartNotificationProps) {
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [historicalAvg, setHistoricalAvg] = useState<number>(DEFAULT_BENCHMARK);
  const [historicalLoaded, setHistoricalLoaded] = useState(false);
  const [longestDryStreak, setLongestDryStreak] = useState(DEFAULT_BENCHMARK);

  const prevSalesRef = useRef(0);
  const prevApproachesRef = useRef(0);
  const approachesSinceLastSaleRef = useRef(0);
  const shownTriggersRef = useRef<Set<string>>(new Set());

  // Load historical data on mount
  useEffect(() => {
    if (!userId) return;
    loadHistory();
  }, [userId]);

  const loadHistory = async () => {
    const today = getBrazilDate();
    const { data: sessions } = await supabase
      .from("challenge_sessions")
      .select("id, date")
      .eq("user_id", userId)
      .neq("date", today)
      .in("status", ["completed", "abandoned"])
      .order("date", { ascending: false })
      .limit(7);

    if (!sessions || sessions.length === 0) {
      setHistoricalAvg(DEFAULT_BENCHMARK);
      setHistoricalLoaded(true);
      return;
    }

    let totalApp = 0;
    let totalSales = 0;
    let maxDry = 0;

    for (const session of sessions) {
      const { data: blocks } = await supabase
        .from("challenge_blocks")
        .select("approaches_count, sold_amount")
        .eq("session_id", session.id);

      if (blocks) {
        const dayApp = blocks.reduce((s, b) => s + (b.approaches_count || 0), 0);
        const daySales = blocks.filter(b => (b.sold_amount || 0) > 0).length;
        totalApp += dayApp;
        totalSales += daySales;
      }
    }

    const avg = totalSales > 0 ? totalApp / totalSales : DEFAULT_BENCHMARK;
    setHistoricalAvg(Math.round(avg * 10) / 10);
    setLongestDryStreak(Math.max(maxDry, Math.round(avg * 1.5)));
    setHistoricalLoaded(true);
  };

  const showNotification = useCallback((icon: string, message: string) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, icon, message, timestamp: Date.now() }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Track approach-without-sale streaks
  useEffect(() => {
    if (phase !== "running" || !historicalLoaded) return;

    const newSale = totalSalesCount > prevSalesRef.current;
    const newApproach = totalApproaches > prevApproachesRef.current;

    if (newApproach && !newSale) {
      approachesSinceLastSaleRef.current += (totalApproaches - prevApproachesRef.current);
    }

    if (newSale) {
      const salesDiff = totalSalesCount - prevSalesRef.current;

      // TRIGGER 1 — First sale of the day
      if (prevSalesRef.current === 0 && totalSalesCount > 0 && !shownTriggersRef.current.has("first_sale")) {
        shownTriggersRef.current.add("first_sale");
        const avgStr = historicalAvg.toFixed(0);
        showNotification(
          "⚡",
          `Primeira venda! Você abordou ${totalApproaches} pessoas. Seu ritmo histórico é 1 venda a cada ${avgStr} abordagens.`
        );
      }

      // Reset dry streak on sale
      approachesSinceLastSaleRef.current = 0;

      // TRIGGER 2/3 — Better or worse than historical
      if (totalSalesCount >= 2) {
        const currentAvg = totalApproaches / totalSalesCount;
        const triggerKey = `perf_check_${totalSalesCount}`;
        if (!shownTriggersRef.current.has(triggerKey)) {
          shownTriggersRef.current.add(triggerKey);
          if (currentAvg < historicalAvg * 0.85) {
            showNotification(
              "🔥",
              `Você tá convertendo melhor que de costume! Histórico: 1 a cada ${historicalAvg.toFixed(0)}. Hoje: 1 a cada ${currentAvg.toFixed(0)}. Repete isso.`
            );
          } else if (currentAvg > historicalAvg * 1.4) {
            showNotification(
              "🧠",
              `Hoje tá em 1 venda a cada ${currentAvg.toFixed(0)} abordagens. Histórico: ${historicalAvg.toFixed(0)}. Isso é normal — cada "não" te aproxima do próximo "sim".`
            );
          }
        }
      }
    }

    // TRIGGER 4 — Every 10 approaches milestone
    if (totalApproaches > 0 && totalApproaches % 10 === 0 && newApproach) {
      const triggerKey = `milestone_${totalApproaches}`;
      if (!shownTriggersRef.current.has(triggerKey)) {
        shownTriggersRef.current.add(triggerKey);
        const expectedSales = Math.round(totalApproaches / historicalAvg);
        const remaining = Math.max(0, Math.round(historicalAvg - (approachesSinceLastSaleRef.current)));
        showNotification(
          "📊",
          `${totalApproaches} abordagens. Se seu padrão se mantiver, você tem ~${expectedSales} vendas previstas. Não para.`
        );
      }
    }

    // TRIGGER 5 — 5+ approaches without a sale
    if (approachesSinceLastSaleRef.current >= 5 && newApproach) {
      const dryCount = approachesSinceLastSaleRef.current;
      const triggerKey = `dry_${Math.floor(dryCount / 5) * 5}`;
      if (!shownTriggersRef.current.has(triggerKey)) {
        shownTriggersRef.current.add(triggerKey);
        const maxDry = Math.max(longestDryStreak, dryCount);
        showNotification(
          "🧠",
          `${dryCount} abordagens sem vender. Seu recorde de sequência sem venda foi ${maxDry} — e você vendeu logo depois. O próximo "sim" tá chegando.`
        );
      }
    }

    prevSalesRef.current = totalSalesCount;
    prevApproachesRef.current = totalApproaches;
  }, [totalApproaches, totalSalesCount, phase, historicalLoaded]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto bg-neutral-900/95 backdrop-blur-sm border border-neutral-700/50 rounded-xl px-4 py-3 flex items-start gap-3 animate-in slide-in-from-top duration-300 shadow-lg shadow-black/50"
          onClick={() => dismissNotification(n.id)}
          role="button"
          tabIndex={0}
        >
          <span className="text-xl flex-shrink-0 mt-0.5">{n.icon}</span>
          <p className="text-xs font-mono text-neutral-300 leading-relaxed line-clamp-3">
            {n.message}
          </p>
        </div>
      ))}
    </div>
  );
}
