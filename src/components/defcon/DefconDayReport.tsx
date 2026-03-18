import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface DefconDayReportProps {
  totalApproaches: number;
  totalSales: number;
  totalSold: number;
  dailyGoal: number;
  userId: string;
  onDismiss: () => void;
}

export function DefconDayReport({
  totalApproaches,
  totalSales,
  totalSold,
  dailyGoal,
  userId,
  onDismiss,
}: DefconDayReportProps) {
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [yesterdayApproaches, setYesterdayApproaches] = useState<number | null>(null);

  const conversionRate = totalApproaches > 0 ? (totalSales / totalApproaches) * 100 : 0;

  useEffect(() => {
    loadYesterdayData();
    fetchAiTip();
  }, []);

  const loadYesterdayData = async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const { data } = await supabase
      .from("challenge_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("date", yesterdayStr)
      .maybeSingle();

    if (data) {
      const { data: blocks } = await supabase
        .from("challenge_blocks")
        .select("approaches_count")
        .eq("session_id", data.id);

      if (blocks) {
        setYesterdayApproaches(blocks.reduce((sum, b) => sum + (b.approaches_count || 0), 0));
      }
    }
  };

  const fetchAiTip = async () => {
    if (totalApproaches === 0) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insights", {
        body: {
          type: "defcon_day_report",
          approaches: totalApproaches,
          sales: totalSales,
          conversionRate: conversionRate.toFixed(1),
        },
      });
      if (!error && data?.tip) {
        setAiTip(data.tip);
      }
    } catch {
      // silently fail
    } finally {
      setAiLoading(false);
    }
  };

  const approachDiff = yesterdayApproaches !== null ? totalApproaches - yesterdayApproaches : null;
  const approachDiffPct = yesterdayApproaches && yesterdayApproaches > 0
    ? ((totalApproaches - yesterdayApproaches) / yesterdayApproaches) * 100
    : null;

  return (
    <div className="w-full max-w-sm space-y-4 mt-6">
      <div className="text-xs font-mono text-neutral-600 tracking-[0.3em] uppercase text-center mb-2">
        📊 Relatório de Abordagens
      </div>

      <div className="bg-neutral-900 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-mono text-neutral-500">👤 Abordagens totais</span>
          <span className="text-xl font-black text-white">{totalApproaches}</span>
        </div>

        <div className="h-px bg-neutral-800" />

        <div className="flex justify-between items-center">
          <span className="text-sm font-mono text-neutral-500">🛒 Vendas realizadas</span>
          <span className="text-xl font-black text-green-500">{totalSales}</span>
        </div>

        <div className="h-px bg-neutral-800" />

        <div className="flex justify-between items-center">
          <span className="text-sm font-mono text-neutral-500">📊 Taxa de conversão</span>
          <span className={`text-xl font-black ${
            conversionRate >= 30 ? "text-green-500" : conversionRate >= 15 ? "text-amber-500" : "text-red-500"
          }`}>
            {conversionRate.toFixed(0)}%
          </span>
        </div>

        {approachDiff !== null && yesterdayApproaches !== null && (
          <>
            <div className="h-px bg-neutral-800" />
            <div className="text-xs font-mono text-neutral-500 text-center">
              Hoje você abordou {totalApproaches} pessoas. Ontem foram {yesterdayApproaches}.{" "}
              <span className={approachDiff >= 0 ? "text-green-500" : "text-red-500"}>
                {approachDiff >= 0 ? "▲" : "▼"} {Math.abs(approachDiffPct || 0).toFixed(0)}%
              </span>
            </div>
          </>
        )}
      </div>

      {/* AI tip */}
      {aiLoading && (
        <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4 text-center">
          <span className="text-xs font-mono text-neutral-500 animate-pulse">🤖 Analisando seus dados...</span>
        </div>
      )}
      {aiTip && (
        <div className="bg-neutral-900 border border-blue-900/30 rounded-xl p-4">
          <div className="text-xs font-mono text-blue-500 tracking-widest uppercase mb-2">🤖 Dica da IA</div>
          <p className="text-sm text-neutral-300 font-mono leading-relaxed">{aiTip}</p>
        </div>
      )}
    </div>
  );
}
