import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDefconChallenge } from "@/hooks/useDefconChallenge";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { DefconTimer } from "@/components/defcon/DefconTimer";
import { DefconCheckpoint } from "@/components/defcon/DefconCheckpoint";
import { DefconDecision } from "@/components/defcon/DefconDecision";
import { DefconMission } from "@/components/defcon/DefconMission";
import { DefconStartScreen } from "@/components/defcon/DefconStartScreen";
import { DefconEndScreen } from "@/components/defcon/DefconEndScreen";

export default function DefconChallenge() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    session,
    currentBlock,
    blocks,
    phase,
    setPhase,
    remainingSeconds,
    loading,
    startChallenge,
    submitBlockSales,
    advanceToNextBlock,
    endChallenge,
    completeChallenge,
  } = useDefconChallenge(user?.id);

  const [dailyGoal, setDailyGoal] = useState<number>(0);
  const [lastSaleAmount, setLastSaleAmount] = useState<number>(0);
  const [showDecision, setShowDecision] = useState(false);

  // Load user's daily goal from profile
  useEffect(() => {
    if (!user) return;
    const loadGoal = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("base_daily_goal")
        .eq("user_id", user.id)
        .single();
      if (data?.base_daily_goal) {
        setDailyGoal(data.base_daily_goal);
      }
    };
    loadGoal();
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-2xl font-mono text-red-500 animate-pulse">
          CARREGANDO DEFCON 4...
        </div>
      </div>
    );
  }

  const handleStart = async (goal: number) => {
    setDailyGoal(goal);
    await startChallenge(goal);
  };

  const handleCheckpointSubmit = async (amount: number) => {
    await submitBlockSales(amount);
    setLastSaleAmount(amount);
    setShowDecision(true);
  };

  const handleAdvance = async () => {
    setShowDecision(false);
    await advanceToNextBlock();
  };

  const handleEnd = async () => {
    setShowDecision(false);
    await endChallenge();
  };

  const handleExit = () => {
    navigate("/daily-goals");
  };

  const missionGoal = session?.daily_goal || dailyGoal;
  const totalSold = session?.total_sold || 0;

  // IDLE - Start screen
  if (phase === "idle") {
    return (
      <DefconStartScreen
        defaultGoal={dailyGoal}
        onStart={handleStart}
        onExit={handleExit}
      />
    );
  }

  // FINISHED or ABANDONED
  if (phase === "finished" || phase === "abandoned") {
    return (
      <DefconEndScreen
        phase={phase}
        totalSold={totalSold}
        dailyGoal={missionGoal}
        totalBlocks={blocks.length}
        onExit={handleExit}
      />
    );
  }

  // RUNNING or CHECKPOINT
  return (
    <div className="min-h-screen bg-black flex flex-col select-none">
      {/* Mission header - always visible */}
      <DefconMission goal={missionGoal} totalSold={totalSold} />

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6">
        {phase === "running" && !showDecision && (
          <DefconTimer
            remainingSeconds={remainingSeconds}
            blockIndex={session?.current_block_index || 0}
            onTimeUp={() => setPhase("checkpoint")}
          />
        )}

        {phase === "checkpoint" && !showDecision && (
          <DefconCheckpoint
            blockIndex={session?.current_block_index || 0}
            onSubmit={handleCheckpointSubmit}
          />
        )}

        {showDecision && (
          <DefconDecision
            saleAmount={lastSaleAmount}
            onAdvance={handleAdvance}
            onEnd={handleEnd}
          />
        )}
      </div>

      {/* Block counter */}
      <div className="pb-8 text-center">
        <span className="text-xs font-mono text-neutral-600 tracking-widest uppercase">
          Bloco {(session?.current_block_index || 0) + 1} • {formatCurrency(totalSold)} vendido
        </span>
      </div>
    </div>
  );
}
