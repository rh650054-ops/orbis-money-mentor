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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Target className="w-7 h-7 text-primary" />
            Seu Dia Hoje
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Meta Diária */}
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Meta Diária</p>
            <p className="text-3xl font-bold text-primary">
              R$ {planning.dailyGoal.toFixed(2)}
            </p>
          </div>

          {/* Grid de informações */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Meta por Hora</span>
              </div>
              <p className="text-xl font-semibold">
                R$ {planning.hourlyGoal.toFixed(2)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Horas de Trabalho</span>
              </div>
              <p className="text-xl font-semibold">{planning.workHours}h</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="text-sm">Dias esta Semana</span>
              </div>
              <p className="text-xl font-semibold">{planning.daysWorkedThisWeek} dias</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="w-4 h-4" />
                <span className="text-sm">Meta Mensal</span>
              </div>
              <p className="text-xl font-semibold">{planning.monthProgress.toFixed(0)}%</p>
            </div>
          </div>

          {/* Botões */}
          <div className="space-y-2 pt-2">
            <Button 
              onClick={handleStart}
              className="w-full"
              size="lg"
            >
              Começar meu dia 🚀
            </Button>
            
            <Button 
              onClick={handleEdit}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar planejamento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
