import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, Clock, TrendingUp, Zap, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { getBrazilDate } from "@/lib/dateUtils";

interface DayStartPopupProps {
  userId: string;
  onStart: () => void;
  onEditPlanning: () => void;
}

type DayStatus = 'not_started' | 'in_progress' | 'finished';

export const DayStartPopup = ({ userId, onStart, onEditPlanning }: DayStartPopupProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(0);
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [workHours, setWorkHours] = useState(0);
  const [dayStatus, setDayStatus] = useState<DayStatus>('not_started');
  const [totalSold, setTotalSold] = useState(0);
  const [percentageAchieved, setPercentageAchieved] = useState(0);

  useEffect(() => {
    loadGoalsAndStatus();
    setIsOpen(true);
    
    // Listen for profile updates
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`
        },
        () => {
          loadGoalsAndStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadGoalsAndStatus = async () => {
    const today = getBrazilDate();
    
    // Load profile goals
    const { data: profile } = await supabase
      .from("profiles")
      .select("base_daily_goal, weekly_goal, monthly_goal, goal_hours")
      .eq("user_id", userId)
      .single();

    if (profile) {
      setDailyGoal(profile.base_daily_goal || 0);
      setWeeklyGoal(profile.weekly_goal || 0);
      setMonthlyGoal(profile.monthly_goal || 0);
      setWorkHours(profile.goal_hours || 0);
    }

    // Check work session status for today
    const { data: session } = await supabase
      .from("work_sessions")
      .select("status, total_vendido")
      .eq("user_id", userId)
      .eq("planning_date", today)
      .maybeSingle();

    if (session) {
      if (session.status === 'finished') {
        setDayStatus('finished');
        setTotalSold(session.total_vendido || 0);
        if (profile?.base_daily_goal) {
          setPercentageAchieved(((session.total_vendido || 0) / profile.base_daily_goal) * 100);
        }
      } else if (session.status === 'active') {
        setDayStatus('in_progress');
      }
    } else {
      setDayStatus('not_started');
    }
  };

  const handleStartDay = () => {
    setIsOpen(false);
    onStart();
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleViewReport = () => {
    setIsOpen(false);
    // Navigate to ritmo page to see report
    window.location.href = '/daily-goals';
  };

  // Title based on day status
  const getTitle = () => {
    if (dayStatus === 'finished') return "📊 Relatório do Dia";
    if (dayStatus === 'in_progress') return "⚡ Seu Dia em Andamento";
    return "⚡ Seu Dia Hoje";
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px] bg-black/95 backdrop-blur-xl border border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600 bg-clip-text text-transparent text-center pb-2">
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Show report summary if day is finished */}
          {dayStatus === 'finished' && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/20 backdrop-blur-sm">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground uppercase tracking-wide">Total Vendido</p>
                <p className="text-3xl font-bold text-green-400">{formatCurrency(totalSold)}</p>
                <p className="text-lg text-muted-foreground">
                  {percentageAchieved.toFixed(0)}% da meta
                </p>
              </div>
            </div>
          )}

          {/* Meta Diária */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/20 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Meta de Hoje</p>
                <p className="text-2xl font-bold whitespace-nowrap">{formatCurrency(dailyGoal)}</p>
              </div>
            </div>
          </div>

          {/* Meta Semanal e Mensal - Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Meta Semanal */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/20 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-green-500" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Semana</p>
              </div>
              <p className="text-lg font-bold whitespace-nowrap">{formatCurrency(weeklyGoal)}</p>
            </div>

            {/* Meta Mensal */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-600/10 border border-purple-500/20 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mês</p>
              </div>
              <p className="text-lg font-bold whitespace-nowrap">{formatCurrency(monthlyGoal)}</p>
            </div>
          </div>

          {/* Horas de Trabalho */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-600/10 border border-orange-500/20 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Horas Planejadas</p>
                <p className="text-2xl font-bold">{workHours}h de trabalho</p>
              </div>
            </div>
          </div>

          {/* Botões baseados no status */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1 h-12 border-white/10 hover:bg-white/5"
            >
              ❌ Fechar
            </Button>
            
            {dayStatus === 'not_started' && (
              <Button
                onClick={handleStartDay}
                className="flex-1 h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 font-semibold shadow-lg shadow-blue-500/50"
              >
                🚀 Iniciar Meu Dia
              </Button>
            )}
            
            {dayStatus === 'in_progress' && (
              <Button
                onClick={handleViewReport}
                className="flex-1 h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 font-semibold shadow-lg shadow-green-500/50"
              >
                ⚡ Continuar Trabalhando
              </Button>
            )}
            
            {dayStatus === 'finished' && (
              <Button
                onClick={handleViewReport}
                className="flex-1 h-12 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 font-semibold shadow-lg shadow-purple-500/50"
              >
                <FileText className="w-4 h-4 mr-2" />
                Ver Relatório
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};