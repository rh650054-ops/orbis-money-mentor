import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Smile, Meh, Frown, Coffee, Zap, Target } from "lucide-react";
import { getBrazilDate } from "@/lib/dateUtils";

interface DailyGoalModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

const moodOptions = [
  { value: "excelente", label: "Excelente", icon: Zap, color: "text-green-500" },
  { value: "bem", label: "Bem", icon: Smile, color: "text-blue-500" },
  { value: "normal", label: "Normal", icon: Coffee, color: "text-yellow-500" },
  { value: "cansado", label: "Cansado", icon: Meh, color: "text-orange-500" },
  { value: "mal", label: "Mal", icon: Frown, color: "text-red-500" },
];

export const DailyGoalModal = ({ open, onClose, userId }: DailyGoalModalProps) => {
  const [dailyGoal, setDailyGoal] = useState("");
  const [workHours, setWorkHours] = useState("");
  const [mood, setMood] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!dailyGoal || !workHours || !mood) {
      toast({
        title: "Preencha todos os campos",
        description: "Defina sua meta, horas de trabalho e como está se sentindo.",
        variant: "destructive",
      });
      return;
    }

    const goalValue = parseFloat(dailyGoal);
    const hours = parseInt(workHours);

    if (goalValue <= 0 || hours <= 0 || hours > 24) {
      toast({
        title: "Valores inválidos",
        description: "Verifique a meta e as horas de trabalho.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const today = getBrazilDate();
      const hourlyGoal = goalValue / hours;

      // Criar o plano diário
      const { data: plan, error: planError } = await supabase
        .from("daily_goal_plans")
        .insert({
          user_id: userId,
          date: today,
          daily_goal: goalValue,
          work_hours: hours,
          mood,
          hourly_goal: hourlyGoal,
        })
        .select()
        .single();

      if (planError) throw planError;

      // Criar os blocos de hora
      const blocks = Array.from({ length: hours }, (_, i) => ({
        plan_id: plan.id,
        user_id: userId,
        hour_index: i,
        hour_label: `Hora ${i + 1}`,
        target_amount: hourlyGoal,
      }));

      const { error: blocksError } = await supabase
        .from("hourly_goal_blocks")
        .insert(blocks);

      if (blocksError) throw blocksError;

      toast({
        title: "🎯 Meta do dia criada!",
        description: `${hours} blocos de R$ ${hourlyGoal.toFixed(2)} cada. Vamos lá!`,
      });

      onClose();
    } catch (error: any) {
      console.error("Erro ao criar meta diária:", error);
      toast({
        title: "Erro ao criar meta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Iniciar meu dia
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Meta diária */}
          <div className="space-y-2">
            <Label htmlFor="daily-goal">Meta diária (R$)</Label>
            <Input
              id="daily-goal"
              type="number"
              placeholder="200.00"
              value={dailyGoal}
              onChange={(e) => setDailyGoal(e.target.value)}
              step="0.01"
              min="0"
            />
          </div>

          {/* Horas de trabalho */}
          <div className="space-y-2">
            <Label htmlFor="work-hours">Quantas horas vai trabalhar?</Label>
            <Input
              id="work-hours"
              type="number"
              placeholder="8"
              value={workHours}
              onChange={(e) => setWorkHours(e.target.value)}
              min="1"
              max="24"
            />
          </div>

          {/* Como está se sentindo */}
          <div className="space-y-3">
            <Label>Como está se sentindo hoje?</Label>
            <div className="grid grid-cols-5 gap-2">
              {moodOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMood(option.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                      mood === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${option.color}`} />
                    <span className="text-xs text-muted-foreground">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? "Criando..." : "Iniciar meu dia 🚀"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
