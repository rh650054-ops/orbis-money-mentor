import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Target, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";

interface WeeklyPlanningProps {
  userId: string;
}

export const WeeklyPlanning = ({ userId }: WeeklyPlanningProps) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [weeklyWorkDays, setWeeklyWorkDays] = useState(5);
  const [baseDailyGoal, setBaseDailyGoal] = useState(200);
  const [weeklyGoal, setWeeklyGoal] = useState(1000);
  const [monthlyGoal, setMonthlyGoal] = useState(4200);

  useEffect(() => {
    loadPlanning();
  }, [userId]);

  const loadPlanning = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("weekly_work_days, base_daily_goal, weekly_goal, monthly_goal")
      .eq("user_id", userId)
      .single();

    if (data) {
      setWeeklyWorkDays(data.weekly_work_days || 5);
      setBaseDailyGoal(data.base_daily_goal || 200);
      setWeeklyGoal(data.weekly_goal || 1000);
      setMonthlyGoal(data.monthly_goal || 4200);
    }
  };

  const handleSave = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({
        weekly_work_days: weeklyWorkDays,
        base_daily_goal: baseDailyGoal,
        weekly_goal: weeklyGoal,
        monthly_goal: monthlyGoal,
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

    setIsEditing(false);
    toast({
      title: "✅ Planejamento atualizado!",
      description: "Suas metas foram salvas com sucesso.",
    });
  };

  return (
    <Card className="card-gradient-border hover:shadow-glow-primary transition-smooth">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Planejamento
          </CardTitle>
          {!isEditing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                <Check className="h-4 w-4 mr-2" />
                Salvar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  loadPlanning();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div className="space-y-2">
              <Label>Dias de trabalho por semana</Label>
              <Input
                type="number"
                min="1"
                max="7"
                value={weeklyWorkDays}
                onChange={(e) => setWeeklyWorkDays(parseInt(e.target.value) || 5)}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta diária base (R$)</Label>
              <Input
                type="number"
                step="10"
                min="0"
                value={baseDailyGoal}
                onChange={(e) => setBaseDailyGoal(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta semanal (R$)</Label>
              <Input
                type="number"
                step="50"
                min="0"
                value={weeklyGoal}
                onChange={(e) => setWeeklyGoal(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta mensal (R$)</Label>
              <Input
                type="number"
                step="100"
                min="0"
                value={monthlyGoal}
                onChange={(e) => setMonthlyGoal(parseFloat(e.target.value) || 0)}
              />
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">📅 Dias/semana</p>
              <p className="text-lg font-bold">{weeklyWorkDays} dias</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">🎯 Meta diária</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(baseDailyGoal)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">📊 Meta semanal</p>
              <p className="text-lg font-bold text-secondary">{formatCurrency(weeklyGoal)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">🏆 Meta mensal</p>
              <p className="text-lg font-bold gradient-text">{formatCurrency(monthlyGoal)}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};