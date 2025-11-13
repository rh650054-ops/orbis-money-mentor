import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Target, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface WeeklyPlanningModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Seg' },
  { key: 'tuesday', label: 'Ter' },
  { key: 'wednesday', label: 'Qua' },
  { key: 'thursday', label: 'Qui' },
  { key: 'friday', label: 'Sex' },
  { key: 'saturday', label: 'Sáb' },
  { key: 'sunday', label: 'Dom' },
];

export default function WeeklyPlanningModal({ userId, isOpen, onClose }: WeeklyPlanningModalProps) {
  const { toast } = useToast();
  const [workingDays, setWorkingDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [baseDailyGoal, setBaseDailyGoal] = useState(200);
  const [weeklyGoal, setWeeklyGoal] = useState(1000);
  const [monthlyGoal, setMonthlyGoal] = useState(4200);

  const toggleDay = (day: string) => {
    setWorkingDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleSave = async () => {
    if (workingDays.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos um dia de trabalho.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        working_days: workingDays,
        base_daily_goal: baseDailyGoal,
        weekly_goal: weeklyGoal,
        monthly_goal: monthlyGoal,
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
            <Calendar className="h-5 w-5 text-primary" />
            Planejamento Semanal
          </DialogTitle>
          <DialogDescription>
            Configure seus dias de trabalho e metas para a semana
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Dias de trabalho */}
          <div className="space-y-3">
            <Label>Dias que você vai trabalhar</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <Badge
                  key={day.key}
                  variant={workingDays.includes(day.key) ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => toggleDay(day.key)}
                >
                  {workingDays.includes(day.key) && <Check className="h-3 w-3 mr-1" />}
                  {day.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Meta diária */}
          <div className="space-y-2">
            <Label htmlFor="dailyGoal">Meta Diária (R$)</Label>
            <Input
              id="dailyGoal"
              type="number"
              value={baseDailyGoal}
              onChange={(e) => setBaseDailyGoal(parseFloat(e.target.value) || 0)}
              placeholder="200"
            />
          </div>

          {/* Meta semanal */}
          <div className="space-y-2">
            <Label htmlFor="weeklyGoal">Meta Semanal (R$)</Label>
            <Input
              id="weeklyGoal"
              type="number"
              value={weeklyGoal}
              onChange={(e) => setWeeklyGoal(parseFloat(e.target.value) || 0)}
              placeholder="1000"
            />
          </div>

          {/* Meta mensal */}
          <div className="space-y-2">
            <Label htmlFor="monthlyGoal">Meta Mensal (R$)</Label>
            <Input
              id="monthlyGoal"
              type="number"
              value={monthlyGoal}
              onChange={(e) => setMonthlyGoal(parseFloat(e.target.value) || 0)}
              placeholder="4200"
            />
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
