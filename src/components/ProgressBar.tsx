import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProgressBarProps {
  userId: string;
}

export const ProgressBar = ({ userId }: ProgressBarProps) => {
  const [salesProgress, setSalesProgress] = useState(0);
  const [tasksProgress, setTasksProgress] = useState(0);
  const [timeProgress, setTimeProgress] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(0);
  const [currentSales, setCurrentSales] = useState(0);

  useEffect(() => {
    loadProgress();

    // Atualizar a cada 5 segundos
    const interval = setInterval(loadProgress, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const loadProgress = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Buscar meta do dia
    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_sales_goal, check_in_start_time, goal_hours")
      .eq("user_id", userId)
      .single();

    if (profile?.daily_sales_goal) {
      setDailyGoal(profile.daily_sales_goal);
    }

    // Buscar vendas do dia
    const { data: sales } = await supabase
      .from("daily_sales")
      .select("total_profit")
      .eq("user_id", userId)
      .eq("date", today);

    const totalSales = sales?.reduce((sum, s) => sum + (s.total_profit || 0), 0) || 0;
    setCurrentSales(totalSales);
    
    if (profile?.daily_sales_goal && profile.daily_sales_goal > 0) {
      const salesPct = Math.min((totalSales / profile.daily_sales_goal) * 100, 100);
      setSalesProgress(salesPct);
    }

    // Buscar tarefas do checklist
    const { data: checklist } = await supabase
      .from("daily_checklist")
      .select("id, completed")
      .eq("user_id", userId)
      .eq("date", today);

    if (checklist && checklist.length > 0) {
      const completed = checklist.filter(t => t.completed).length;
      const tasksPct = (completed / checklist.length) * 100;
      setTasksProgress(tasksPct);
    }

    // Calcular progresso do tempo (baseado no timer de meta)
    if (profile?.goal_hours && profile.goal_hours > 0) {
      const { data: timerProfile } = await supabase
        .from("profiles")
        .select("goal_timer_started_at, goal_timer_active")
        .eq("user_id", userId)
        .single();

      if (timerProfile?.goal_timer_active && timerProfile.goal_timer_started_at) {
        const startTime = new Date(timerProfile.goal_timer_started_at).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        const totalSeconds = profile.goal_hours * 3600;
        const timePct = Math.min((elapsed / totalSeconds) * 100, 100);
        setTimeProgress(timePct);
      }
    }
  };

  const getOverallProgress = () => {
    return Math.round((salesProgress + tasksProgress + timeProgress) / 3);
  };

  const getProgressColor = (value: number) => {
    if (value >= 80) return "text-success";
    if (value >= 50) return "text-warning";
    return "text-primary";
  };

  const overallProgress = getOverallProgress();

  return (
    <Card className="card-gradient-border shadow-glow-primary">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Progresso do Dia</h3>
          <span className={`text-3xl font-bold ${getProgressColor(overallProgress)}`}>
            {overallProgress}%
          </span>
        </div>

        <Progress value={overallProgress} className="h-3" />

        <div className="grid gap-3 pt-2">
          {/* Vendas */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-success" />
              <div>
                <p className="text-sm font-medium">Meta de Vendas</p>
                <p className="text-xs text-muted-foreground">
                  R$ {currentSales.toFixed(2)} / R$ {dailyGoal.toFixed(2)}
                </p>
              </div>
            </div>
            <span className={`text-lg font-bold ${getProgressColor(salesProgress)}`}>
              {salesProgress.toFixed(0)}%
            </span>
          </div>

          {/* Tarefas */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Tarefas Concluídas</p>
                <p className="text-xs text-muted-foreground">Checklist diário</p>
              </div>
            </div>
            <span className={`text-lg font-bold ${getProgressColor(tasksProgress)}`}>
              {tasksProgress.toFixed(0)}%
            </span>
          </div>

          {/* Tempo Focado */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-secondary" />
              <div>
                <p className="text-sm font-medium">Tempo Focado</p>
                <p className="text-xs text-muted-foreground">Timer de meta</p>
              </div>
            </div>
            <span className={`text-lg font-bold ${getProgressColor(timeProgress)}`}>
              {timeProgress.toFixed(0)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
