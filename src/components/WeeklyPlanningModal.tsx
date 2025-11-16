import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WeeklyPlanningModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function WeeklyPlanningModal({ userId, isOpen, onClose }: WeeklyPlanningModalProps) {
  const { toast } = useToast();
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(5);
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [monthlyGoal, setMonthlyGoal] = useState(4200);

  useEffect(() => {
    loadPlanning();
  }, [userId]);

  const loadPlanning = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("weekly_work_days, goal_hours, monthly_goal")
      .eq("user_id", userId)
      .single();

    if (data) {
      setWorkDaysPerWeek(data.weekly_work_days || 5);
      setHoursPerDay(data.goal_hours || 8);
      setMonthlyGoal(data.monthly_goal || 4200);
    }
  };

  const calculateDailyGoal = () => {
    const workDaysInMonth = workDaysPerWeek * 4;
    return monthlyGoal / workDaysInMonth;
  };

  const calculateWeeklyGoal = () => {
    return calculateDailyGoal() * workDaysPerWeek;
  };

  const calculateHourlyGoal = () => {
    return calculateDailyGoal() / hoursPerDay;
  };

  const handleSave = async () => {
    if (workDaysPerWeek <= 0 || hoursPerDay <= 0 || monthlyGoal <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos corretamente.",
        variant: "destructive",
      });
      return;
    }

    const dailyGoal = calculateDailyGoal();
    const weeklyGoal = calculateWeeklyGoal();

    const { error } = await supabase
      .from("profiles")
      .update({
        weekly_work_days: workDaysPerWeek,
        goal_hours: hoursPerDay,
        monthly_goal: monthlyGoal,
        base_daily_goal: dailyGoal,
        weekly_goal: weeklyGoal,
        week_start_date: new Date().toISOString().split('T')[0],
      })
      .eq("user_id", userId);

    if (error) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "✅ Planejamento salvo!",
      description: "Suas metas foram configuradas com sucesso.",
    });
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Planejamento Mensal
          </DialogTitle>
          <DialogDescription>
            Configure sua rotina de trabalho e meta mensal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Meta Mensal */}
          <div className="space-y-2">
            <Label htmlFor="monthlyGoal">Meta Mensal (R$)</Label>
            <Input
              id="monthlyGoal"
              type="number"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(Number(e.target.value))}
              min={1}
              placeholder="Ex: 4200"
            />
          </div>

          {/* Dias por semana */}
          <div className="space-y-2">
            <Label htmlFor="workDays">Quantos dias vai trabalhar na semana?</Label>
            <Input
              id="workDays"
              type="number"
              value={workDaysPerWeek}
              onChange={(e) => setWorkDaysPerWeek(Number(e.target.value))}
              min={1}
              max={7}
              placeholder="Ex: 5"
            />
          </div>

          {/* Horas por dia */}
          <div className="space-y-2">
            <Label htmlFor="hoursPerDay">Quantas horas pretende trabalhar por dia?</Label>
            <Input
              id="hoursPerDay"
              type="number"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Number(e.target.value))}
              min={1}
              max={24}
              placeholder="Ex: 8"
            />
          </div>

          {/* Resumo Calculado */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Metas Calculadas:</p>
            <div className="space-y-1 text-sm">
              <p>Meta Diária: <span className="font-bold">R$ {calculateDailyGoal().toFixed(2)}</span></p>
              <p>Meta Semanal: <span className="font-bold">R$ {calculateWeeklyGoal().toFixed(2)}</span></p>
              <p>Meta por Hora: <span className="font-bold">R$ {calculateHourlyGoal().toFixed(2)}</span></p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex-1">
            <Target className="h-4 w-4 mr-2" />
            Salvar Planejamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
