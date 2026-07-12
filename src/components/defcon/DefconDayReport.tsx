import { useState, useEffect } from "react";
import { formatCurrency } from "@/shared/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDateDaysAgo } from "@/shared/lib/date-utils";

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
    // Fuso BR: new Date()+toISOString() usa UTC e, no fim da tarde/noite (UTC-3, quando
    // o vendedor encerra), "ontem" apontava pro dia errado e não batia com a sessão.
    const yesterdayStr = getBrazilDateDaysAgo(1);

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

  const approachesPerSale = totalSales > 0 ? (totalApproaches / totalSales) : 0;

  return (
    <div className="w-full max-w-sm space-y-4 mt-6">
      <div className="text-xs font-mono text-muted-foreground tracking-[0.3em] uppercase text-center mb-2">
        📊 Relatório de Abordagens
      </div>

      <div className="bg-card rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-mono text-muted-foreground">👤 Abordagens totais</span>
          <span className="text-xl font-black text-foreground">{totalApproaches}</span>
        </div>

        <div className="h-px bg-border" />

        <div className="flex justify-between items-center">
          <span className="text-sm font-mono text-muted-foreground">🛒 Vendas realizadas</span>
          <span className="text-xl font-black text-success">{totalSales}</span>
        </div>

        <div className="h-px bg-border" />

        <div className="flex justify-between items-center">
          <span className="text-sm font-mono text-muted-foreground">📊 Taxa de conversão</span>
          <span className={`text-xl font-black ${
            conversionRate >= 30 ? "text-success" : conversionRate >= 15 ? "text-warning" : "text-destructive"
          }`}>
            {conversionRate.toFixed(0)}%
          </span>
        </div>

        {/* Abordagens por venda é métrica de HOJE — sempre visível (antes ficava
            escondida dentro da comparação com ontem e sumia sem sessão de ontem). */}
        <div className="h-px bg-border" />

        <div className="flex justify-between items-center">
          <span className="text-sm font-mono text-muted-foreground">👥 Abordagens por venda</span>
          <span className="text-xl font-black text-foreground">
            {approachesPerSale > 0 ? `${approachesPerSale.toFixed(1)} pessoas` : "—"}
          </span>
        </div>

        {/* Comparação com ontem: só quando existe sessão de ontem. */}
        {approachDiff !== null && yesterdayApproaches !== null && (
          <>
        <div className="h-px bg-border" />
            <div className="text-xs font-mono text-muted-foreground text-center">
              Hoje você abordou {totalApproaches} pessoas. Ontem foram {yesterdayApproaches}.{" "}
              <span className={approachDiff >= 0 ? "text-success" : "text-destructive"}>
                {approachDiff >= 0 ? "▲" : "▼"} {Math.abs(approachDiffPct || 0).toFixed(0)}%
              </span>
            </div>
          </>
        )}
      </div>

      {/* AI tip */}
      {aiLoading && (
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <span className="text-xs font-mono text-muted-foreground animate-pulse">🤖 Analisando seus dados...</span>
        </div>
      )}
      {aiTip && (
        <div className="bg-card border border-primary/30 rounded-xl p-4">
          <div className="text-xs font-mono text-primary tracking-widest uppercase mb-2">🤖 Dica da IA</div>
          <p className="text-sm text-foreground font-mono leading-relaxed">{aiTip}</p>
        </div>
      )}
    </div>
  );
}
