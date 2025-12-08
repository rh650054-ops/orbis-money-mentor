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
  const [isLoading, setIsLoading] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(0);
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [workHours, setWorkHours] = useState(0);
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);
  const [totalSold, setTotalSold] = useState(0);
  const [percentageAchieved, setPercentageAchieved] = useState(0);

  useEffect(() => {
    const init = async () => {
      await loadGoalsAndStatus();
      setIsOpen(true);
    };
    init();
    
    // Listen for work_sessions updates
    const sessionChannel = supabase
      .channel('session-changes-popup')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_sessions',
          filter: `user_id=eq.${userId}`
        },
        () => {
          console.log('[DayStartPopup] Session changed, reloading...');
          loadGoalsAndStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
    };
  }, [userId]);

  const loadGoalsAndStatus = async () => {
    setIsLoading(true);
    const today = getBrazilDate();
    
    console.log('[DayStartPopup] Loading status for date:', today, 'user:', userId);
    
    // Check work session status for today FIRST - this is the SOURCE OF TRUTH
    const { data: session, error: sessionError } = await supabase
      .from("work_sessions")
      .select("status, total_vendido")
      .eq("user_id", userId)
      .eq("planning_date", today)
      .maybeSingle();

    console.log('[DayStartPopup] Session data:', session, 'error:', sessionError);

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

    // Determine day status based on session
    if (session) {
      if (session.status === 'finished') {
        console.log('[DayStartPopup] Setting status to finished');
        setDayStatus('finished');
        setTotalSold(session.total_vendido || 0);
        if (profile?.base_daily_goal) {
          setPercentageAchieved(((session.total_vendido || 0) / profile.base_daily_goal) * 100);
        }
      } else if (session.status === 'active') {
        console.log('[DayStartPopup] Setting status to in_progress');
        setDayStatus('in_progress');
      } else {
        console.log('[DayStartPopup] Session exists but status is:', session.status);
        setDayStatus('not_started');
      }
    } else {
      console.log('[DayStartPopup] No session found, setting not_started');
      setDayStatus('not_started');
    }
    
    setIsLoading(false);
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
    if (isLoading || dayStatus === null) return "⏳ Carregando...";
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
            
            {!isLoading && dayStatus === 'not_started' && (
              <Button
                onClick={handleStartDay}
                className="flex-1 h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 font-semibold shadow-lg shadow-blue-500/50"
              >
                🚀 Iniciar Meu Dia
              </Button>
            )}
            
            {!isLoading && dayStatus === 'in_progress' && (
              <Button
                onClick={handleViewReport}
                className="flex-1 h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 font-semibold shadow-lg shadow-green-500/50"
              >
                ⚡ Continuar Trabalhando
              </Button>
            )}
            
            {!isLoading && dayStatus === 'finished' && (
              <Button
                onClick={handleViewReport}
                className="flex-1 h-12 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 font-semibold shadow-lg shadow-purple-500/50"
              >
                <FileText className="w-4 h-4 mr-2" />
                Ver Relatório
              </Button>
            )}
            
            {isLoading && (
              <Button
                disabled
                className="flex-1 h-12 bg-gradient-to-r from-gray-500 to-gray-600 font-semibold"
              >
                Carregando...
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};