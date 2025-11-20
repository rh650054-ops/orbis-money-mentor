import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, Clock, TrendingUp, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";

interface DayStartPopupProps {
  userId: string;
  onStart: () => void;
  onEditPlanning: () => void;
}

export const DayStartPopup = ({ userId, onStart, onEditPlanning }: DayStartPopupProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(0);
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [workHours, setWorkHours] = useState(0);

  useEffect(() => {
    loadGoals();
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
          loadGoals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const checkAndShowPopup = async () => {
    await loadGoals();
    setIsOpen(true);
  };

  const loadGoals = async () => {
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
  };

  const handleStartDay = () => {
    setIsOpen(false);
    onStart();
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px] bg-black/95 backdrop-blur-xl border border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600 bg-clip-text text-transparent text-center pb-2">
            ⚡ Seu Dia Hoje
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1 h-12 border-white/10 hover:bg-white/5"
            >
              ❌ Fechar
            </Button>
            <Button
              onClick={handleStartDay}
              className="flex-1 h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 font-semibold shadow-lg shadow-blue-500/50"
            >
              🚀 Iniciar Meu Dia
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
