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
      <DialogContent className="sm:max-w-lg animate-fade-in card-gradient-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-3xl font-bold">
            <span className="gradient-text">Seu Dia Hoje</span>
            <button
              onClick={() => {
                setIsOpen(false);
                const today = getBrazilDate();
                localStorage.setItem(`popup_shown_${userId}_${today}`, "true");
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ❌
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Meta Diária */}
          <div className="bg-gradient-primary rounded-lg p-6 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="relative z-10">
              <p className="text-sm text-white/80 mb-1 font-medium">Meta Diária</p>
              <p className="text-4xl font-bold text-white">
                R$ {planning.dailyGoal.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Grid de informações */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Meta por Hora</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                R$ {planning.hourlyGoal.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2 bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="w-5 h-5 text-secondary" />
                <span className="text-sm font-medium">Horas de Trabalho</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{planning.workHours}h</p>
            </div>

            <div className="space-y-2 bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-5 h-5 text-accent" />
                <span className="text-sm font-medium">Dias esta Semana</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{planning.daysWorkedThisWeek} dias</p>
            </div>

            <div className="space-y-2 bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Target className="w-5 h-5 text-success" />
                <span className="text-sm font-medium">Meta Mensal</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{planning.monthProgress.toFixed(0)}%</p>
            </div>
          </div>

          {/* Botões */}
          <div className="space-y-3 pt-2">
            <Button 
              onClick={handleStart}
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity shadow-glow-primary"
              size="lg"
            >
              Iniciar Meu Dia 🚀
            </Button>
            
            <Button 
              onClick={handleEdit}
              variant="outline"
              className="w-full border-primary/30 hover:bg-primary/10"
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
