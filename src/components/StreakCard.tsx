import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface StreakCardProps {
  userId: string;
}

export default function StreakCard({ userId }: StreakCardProps) {
  const navigate = useNavigate();
  const [streak, setStreak] = useState(0);
  const [routineProgress, setRoutineProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      // Load streak from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("streak_days")
        .eq("user_id", userId)
        .maybeSingle();
      setStreak(profile?.streak_days || 0);

      // Load today's routine progress
      const today = new Date().toISOString().split("T")[0]!;
      const { data: checklist } = await supabase
        .from("daily_checklist")
        .select("completed")
        .eq("user_id", userId)
        .eq("date", today);

      if (checklist && checklist.length > 0) {
        const done = checklist.filter((c) => c.completed).length;
        setRoutineProgress({ done, total: checklist.length });
      }
    };
    load();
  }, [userId]);

  const getFireSize = () => {
    if (streak >= 30) return "text-5xl";
    if (streak >= 7) return "text-4xl";
    return "text-3xl";
  };

  const getMessage = () => {
    if (streak === 0) return "Sua sequência foi reiniciada. Recomece hoje.";
    if (streak <= 2) return "Bom começo! Continue.";
    if (streak <= 6) return "Você está criando um hábito!";
    if (streak <= 29) return "Semana completa! Imparável.";
    return "Lenda. Você é um Visionário.";
  };

  const routinePercent = routineProgress.total > 0
    ? (routineProgress.done / routineProgress.total) * 100
    : 0;

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <span className={getFireSize()}>🔥</span>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{streak}</span>
              <span className="text-sm text-muted-foreground">dias seguidos</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{getMessage()}</p>
          </div>
        </div>
      </div>

      {routineProgress.total > 0 && (
        <button
          onClick={() => navigate("/routine")}
          className="w-full bg-card border border-border rounded-xl p-4 text-left active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              Rotina de hoje: {routineProgress.done}/{routineProgress.total} hábitos
            </span>
            <span className="text-xs text-primary">Ver →</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${routinePercent}%` }}
            />
          </div>
        </button>
      )}
    </div>
  );
}
