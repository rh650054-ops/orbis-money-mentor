import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDefconChallenge } from "@/hooks/useDefconChallenge";
import { DefconStartScreen } from "@/components/defcon/DefconStartScreen";
import { DefconRunning } from "@/components/defcon/DefconRunning";
import { DefconBreak } from "@/components/defcon/DefconBreak";
import { DefconEndScreen } from "@/components/defcon/DefconEndScreen";
import { DefconLunchPause } from "@/components/defcon/DefconLunchPause";
import { DefconBlockReport } from "@/components/defcon/DefconBlockReport";
import { DefconDayReport } from "@/components/defcon/DefconDayReport";

export default function DefconChallenge() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const defcon = useDefconChallenge(user?.id);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  if (authLoading || defcon.loading || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-2xl font-mono text-red-500 animate-pulse">
          CARREGANDO DEFCON 4...
        </div>
      </div>
    );
  }

  if (!defcon.hasPlan) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold text-white mb-3">Sem plano hoje</h1>
        <p className="text-sm text-neutral-500 font-mono text-center mb-8">
          Vá até o Ritmo para criar seu plano do dia antes de iniciar o DEFCON 4.
        </p>
        <button
          onClick={() => navigate("/daily-goals")}
          className="h-14 px-8 bg-neutral-900 border border-neutral-700 text-white font-bold rounded-xl active:scale-95 transition-transform"
        >
          IR PARA O RITMO
        </button>
      </div>
    );
  }

  const handleExit = () => navigate("/daily-goals");

  switch (defcon.phase) {
    case "idle":
      return (
        <DefconStartScreen
          dailyGoal={defcon.dailyGoal}
          totalBlocks={defcon.blocks.length}
          onStart={defcon.startChallenge}
          onExit={handleExit}
        />
      );

    case "running":
      return (
        <DefconRunning
          userId={user.id}
          dailyGoal={defcon.dailyGoal}
          totalSold={defcon.totalSold}
          currentBlock={defcon.currentBlock}
          currentBlockIndex={defcon.currentBlockIndex}
          totalBlocks={defcon.blocks.length}
          remainingSeconds={defcon.remainingSeconds}
          blockStartedAt={defcon.blockStartedAt}
          blockEndTime={defcon.blockEndTime}
          lunchPauseUsed={defcon.lunchPauseUsed}
          blockApproaches={defcon.blockApproaches}
          totalApproaches={defcon.totalApproaches}
          totalSalesCount={defcon.totalSalesCount}
          blockSalesCount={defcon.blockSalesCount}
          onAddSale={defcon.addSale}
          onAddApproach={defcon.addApproach}
          onAddOccurrence={defcon.addOccurrence}
          onEnd={defcon.endChallenge}
          onLunchPause={defcon.startLunchPause}
        />
      );

    case "block_report":
      return defcon.blockReportData ? (
        <DefconBlockReport
          blockIndex={defcon.blockReportData.blockIndex}
          approaches={defcon.blockReportData.approaches}
          sales={defcon.blockReportData.sales}
          soldAmount={defcon.blockReportData.soldAmount}
          onContinue={defcon.dismissBlockReport}
        />
      ) : null;

    case "break":
      return (
        <DefconBreak
          breakRemaining={defcon.breakRemaining}
          currentBlockIndex={defcon.currentBlockIndex}
          blockSold={defcon.currentBlock?.achieved_amount || 0}
        />
      );

    case "lunch_pause":
      return (
        <DefconLunchPause
          lunchPauseRemaining={defcon.lunchPauseRemaining}
          totalSold={defcon.totalSold}
        />
      );

    case "finished":
    case "abandoned":
      return (
        <DefconEndScreen
          phase={defcon.phase}
          totalSold={defcon.totalSold}
          dailyGoal={defcon.dailyGoal}
          totalBlocks={defcon.currentBlockIndex + 1}
          totalApproaches={defcon.totalApproaches}
          totalSalesCount={defcon.totalSalesCount}
          onSaveBreakdown={defcon.savePaymentBreakdown}
          onExit={handleExit}
        />
      );

    default:
      return null;
  }
}
