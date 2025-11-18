import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, Clock, Calendar, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";

interface DayStartPopupProps {
  userId: string;
  onStart: () => void;
  onEditPlanning: () => void;
}

interface PlanningData {
  monthlyGoal: number;
  weeklyGoal: number;
  dailyGoal: number;
  hourlyGoal: number;
  workHours: number;
  daysWorkedThisWeek: number;
  monthProgress: number;
}

export const DayStartPopup = ({ userId, onStart, onEditPlanning }: DayStartPopupProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [planning, setPlanning] = useState<PlanningData | null>(null);

  useEffect(() => {
    checkAndShowPopup();
  }, [userId]);

  const checkAndShowPopup = async () => {
    const today = getBrazilDate();
    const lastShown = localStorage.getItem(`popup_shown_${userId}_${today}`);
    
    if (lastShown) {
      return; // Já mostrou hoje
    }

    // Verificar se é dia de trabalho
    const { data: profile } = await supabase
      .from("profiles")
      .select("working_days, monthly_goal, base_daily_goal, goal_hours")
      .eq("user_id", userId)
      .single();

    if (!profile) return;

    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
    const isWorkDay = profile.working_days?.includes(dayOfWeek);

    if (!isWorkDay) {
      return; // Não mostrar em dias de folga
    }

    // Calcular dados
    const workDaysCount = profile.working_days?.length || 5;
    const dailyGoal = profile.base_daily_goal || (profile.monthly_goal || 4200) / (workDaysCount * 4);
    const hourlyGoal = dailyGoal / (profile.goal_hours || 8);

    // Buscar progresso da semana
    const weekStart = getWeekStart();
    const { data: workLogs } = await supabase
      .from("daily_work_log")
      .select("date")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .eq("status", "worked");

    const daysWorkedThisWeek = workLogs?.length || 0;

    // Buscar progresso do mês
    const monthStart = getMonthStart();
    const { data: monthlySales } = await supabase
      .from("daily_sales")
      .select("total_profit")
      .eq("user_id", userId)
      .gte("date", monthStart);

    const monthTotal = monthlySales?.reduce((sum, s) => sum + (Number(s.total_profit) || 0), 0) || 0;
    const monthProgress = (monthTotal / (profile.monthly_goal || 4200)) * 100;

    setPlanning({
      monthlyGoal: profile.monthly_goal || 4200,
      weeklyGoal: dailyGoal * workDaysCount,
      dailyGoal,
      hourlyGoal,
      workHours: profile.goal_hours || 8,
      daysWorkedThisWeek,
      monthProgress,
    });

    setIsOpen(true);
  };

  const getWeekStart = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return monday.toISOString().split('T')[0];
  };

  const getMonthStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  };

  const handleStart = () => {
    const today = getBrazilDate();
    localStorage.setItem(`popup_shown_${userId}_${today}`, "true");
    setIsOpen(false);
    onStart();
    navigate("/daily-goals");
  };

  const handleEdit = () => {
    setIsOpen(false);
    onEditPlanning();
  };

  if (!planning) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        const today = getBrazilDate();
        localStorage.setItem(`popup_shown_${userId}_${today}`, "true");
      }
      setIsOpen(open);
    }}>
      <DialogContent className="sm:max-w-2xl animate-scale-in backdrop-blur-xl bg-black/90 border border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-4xl font-bold text-center mb-6">
            <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600 bg-clip-text text-transparent">
              Seu Dia Hoje
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Meta Diária - Destaque Principal */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 p-6 backdrop-blur-sm border border-white/10">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-600/10"></div>
            <div className="relative z-10 text-center">
              <p className="text-sm text-white/70 mb-2 font-medium uppercase tracking-wide">Meta de Hoje</p>
              <p className="text-5xl font-bold text-white mb-1">
                R$ {planning.dailyGoal.toFixed(2)}
              </p>
              <p className="text-xs text-white/50">Meta por hora: R$ {planning.hourlyGoal.toFixed(2)}</p>
            </div>
          </div>

          {/* Grid de Informações */}
          <div className="grid grid-cols-2 gap-3">
            {/* Horas de Trabalho */}
            <div className="rounded-xl bg-white/5 backdrop-blur-sm p-4 border border-white/10 hover:bg-white/10 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wide">Horas</p>
                  <p className="text-2xl font-bold text-white">{planning.workHours}h</p>
                </div>
              </div>
            </div>

            {/* Meta Semanal */}
            <div className="rounded-xl bg-white/5 backdrop-blur-sm p-4 border border-white/10 hover:bg-white/10 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wide">Semana</p>
                  <p className="text-2xl font-bold text-white">R$ {planning.weeklyGoal.toFixed(0)}</p>
                </div>
              </div>
            </div>

            {/* Dias Trabalhados */}
            <div className="rounded-xl bg-white/5 backdrop-blur-sm p-4 border border-white/10 hover:bg-white/10 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wide">Esta Semana</p>
                  <p className="text-2xl font-bold text-white">{planning.daysWorkedThisWeek} dias</p>
                </div>
              </div>
            </div>

            {/* Progresso Mensal */}
            <div className="rounded-xl bg-white/5 backdrop-blur-sm p-4 border border-white/10 hover:bg-white/10 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-white/60 uppercase tracking-wide">Meta Mensal</p>
                  <p className="text-2xl font-bold text-white">{planning.monthProgress.toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-3 pt-4">
            <Button 
              onClick={handleStart}
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all rounded-xl"
            >
              🚀 Começar Meu Dia
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={handleEdit}
                variant="outline"
                className="h-12 border-white/20 hover:bg-white/10 text-white rounded-xl"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
              
              <Button 
                onClick={() => {
                  const today = getBrazilDate();
                  localStorage.setItem(`popup_shown_${userId}_${today}`, "true");
                  setIsOpen(false);
                }}
                variant="ghost"
                className="h-12 hover:bg-white/10 text-white/70 rounded-xl"
              >
                ❌ Fechar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
