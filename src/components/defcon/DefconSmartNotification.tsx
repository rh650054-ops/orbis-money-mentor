import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { X } from "lucide-react";

interface SmartNotification {
  id: string;
  icon: string;
  message: string;
  timestamp: number;
  holdingDown: boolean;
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

const NOTIFICATION_DURATION = 7000; // 7 seconds
const DEFAULT_BENCHMARK = 8;

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
  const holdingRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
    setNotifications(prev => [...prev, { id, icon, message, timestamp: Date.now(), holdingDown: false }]);
    const timer = setTimeout(() => {
      if (!holdingRef.current.has(id)) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
      timersRef.current.delete(id);
    }, NOTIFICATION_DURATION);
    timersRef.current.set(id, timer);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    holdingRef.current.delete(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const holdStart = useCallback((id: string) => {
    holdingRef.current.add(id);
  }, []);

  const holdEnd = useCallback((id: string) => {
    holdingRef.current.delete(id);
    // Start a new dismiss timer
    const timer = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      timersRef.current.delete(id);
    }, 3000);
    timersRef.current.set(id, timer);
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
      // TRIGGER 1 — First sale of the day
      if (prevSalesRef.current === 0 && totalSalesCount > 0 && !shownTriggersRef.current.has("first_sale")) {
        shownTriggersRef.current.add("first_sale");
        const avgStr = historicalAvg.toFixed(0);
        showNotification(
          "⚡",
          `Primeira venda! ${totalApproaches} abordagens até aqui. Seu histórico: 1 venda a cada ${avgStr} abordagens. ${totalApproaches <= historicalAvg ? "Mais rápido que o normal. Mantém esse ritmo." : "Dentro do esperado. Segue firme."}`
        );
      }

      // Reset dry streak on sale
      approachesSinceLastSaleRef.current = 0;

      // TRIGGER 2/3 — Performance comparison (every 2 sales after the 2nd)
      if (totalSalesCount >= 2) {
        const currentAvg = totalApproaches / totalSalesCount;
        const triggerKey = `perf_check_${totalSalesCount}`;
        if (!shownTriggersRef.current.has(triggerKey)) {
          shownTriggersRef.current.add(triggerKey);
          const pctDiff = Math.abs(((currentAvg - historicalAvg) / historicalAvg) * 100).toFixed(0);
          
          if (currentAvg < historicalAvg * 0.85) {
            showNotification(
              "🔥",
              `${totalSalesCount} vendas em ${totalApproaches} abordagens. ${(totalSalesCount / totalApproaches * 100).toFixed(0)}% de conversão. Histórico: 1 a cada ${historicalAvg.toFixed(0)}. Hoje: 1 a cada ${currentAvg.toFixed(0)}. Você tá ${pctDiff}% acima do normal. O que fez diferente? Repete.`
            );
          } else if (currentAvg > historicalAvg * 1.4) {
            showNotification(
              "🧠",
              `${totalSalesCount} vendas em ${totalApproaches} abordagens — 1 a cada ${currentAvg.toFixed(0)}. Histórico: ${historicalAvg.toFixed(0)}. Faltam ${Math.max(0, Math.round(historicalAvg - approachesSinceLastSaleRef.current))} abordagens pro próximo "sim" estatístico. Cada "não" te aproxima.`
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
        const currentConversion = totalSalesCount > 0 ? (totalSalesCount / totalApproaches * 100).toFixed(0) : "0";
        showNotification(
          "📊",
          `${totalApproaches} abordagens, ${totalSalesCount} vendas (${currentConversion}%). Se seu padrão se mantiver, ~${expectedSales} vendas previstas. ${totalSalesCount >= expectedSales ? "Você tá acima da previsão. Segue." : `Faltam ~${Math.max(0, expectedSales - totalSalesCount)} vendas pra igualar sua média.`}`
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
        const remaining = maxDry - dryCount;
        showNotification(
          "🧠",
          `${dryCount} abordagens sem vender. Seu recorde de sequência sem venda: ${maxDry}. ${remaining > 0 ? `Faltam ${remaining} pro recorde — e depois dele você sempre vendeu.` : "Você igualou o recorde. A próxima venda tá na esquina."}`
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
        <NotificationCard
          key={n.id}
          notification={n}
          onDismiss={() => dismissNotification(n.id)}
          onHoldStart={() => holdStart(n.id)}
          onHoldEnd={() => holdEnd(n.id)}
        />
      ))}
    </div>
  );
}

function NotificationCard({
  notification,
  onDismiss,
  onHoldStart,
  onHoldEnd,
}: {
  notification: SmartNotification;
  onDismiss: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}) {
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef(Date.now());
  const holdingRef = useRef(false);
  const pausedAtRef = useRef<number | null>(null);
  const elapsedBeforePauseRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (holdingRef.current) return;
      
      const elapsed = elapsedBeforePauseRef.current + (Date.now() - (pausedAtRef.current !== null ? Date.now() : startTimeRef.current));
      const realElapsed = elapsedBeforePauseRef.current + (Date.now() - startTimeRef.current);
      const pct = Math.max(0, 100 - (realElapsed / NOTIFICATION_DURATION) * 100);
      setProgress(pct);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const handleTouchStart = () => {
    holdingRef.current = true;
    elapsedBeforePauseRef.current += Date.now() - startTimeRef.current;
    onHoldStart();
  };

  const handleTouchEnd = () => {
    holdingRef.current = false;
    startTimeRef.current = Date.now();
    onHoldEnd();
  };

  return (
    <div
      className="pointer-events-auto bg-neutral-900/95 backdrop-blur-sm border border-neutral-700/50 rounded-xl overflow-hidden animate-in slide-in-from-top duration-300 shadow-lg shadow-black/50"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={() => { if (holdingRef.current) handleTouchEnd(); }}
    >
      <div className="px-4 py-3 flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">{notification.icon}</span>
        <p className="text-xs font-mono text-neutral-300 leading-relaxed flex-1">
          {notification.message}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="flex-shrink-0 mt-0.5"
        >
          <X className="w-4 h-4 text-neutral-600 active:text-neutral-300" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 w-full bg-neutral-800">
        <div
          className="h-full bg-neutral-500/50 transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
