import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar, Target, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface WeeklyPlanningProps {
  userId: string;
  onEditPlanning?: () => void;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Seg', fullLabel: 'Segunda' },
  { key: 'tuesday', label: 'Ter', fullLabel: 'Terça' },
  { key: 'wednesday', label: 'Qua', fullLabel: 'Quarta' },
  { key: 'thursday', label: 'Qui', fullLabel: 'Quinta' },
  { key: 'friday', label: 'Sex', fullLabel: 'Sexta' },
  { key: 'saturday', label: 'Sáb', fullLabel: 'Sábado' },
  { key: 'sunday', label: 'Dom', fullLabel: 'Domingo' },
];

export const WeeklyPlanning = ({ userId, onEditPlanning }: WeeklyPlanningProps) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [workingDays, setWorkingDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [baseDailyGoal, setBaseDailyGoal] = useState(200);
  const [weeklyGoal, setWeeklyGoal] = useState(1000);
  const [monthlyGoal, setMonthlyGoal] = useState(4200);

  useEffect(() => {
    loadPlanning();
    
    // Listen for profile updates
    const channel = supabase
      .channel('planning-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`
        },
        () => {
          loadPlanning();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadPlanning = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("working_days, base_daily_goal, weekly_goal, monthly_goal")
      .eq("user_id", userId)
      .single();

    if (data) {
      setWorkingDays(data.working_days || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
      setBaseDailyGoal(data.base_daily_goal || 200);
      setWeeklyGoal(data.weekly_goal || 1000);
      setMonthlyGoal(data.monthly_goal || 4200);
    }
  };

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
        title: "Erro ao salvar",
        description: "Selecione pelo menos um dia de trabalho.",
        variant: "destructive",
      });
      return;
    }

    // Only update working_days, the rest is read-only
    const { error } = await supabase
      .from("profiles")
      .update({
        working_days: workingDays,
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
      title: "✅ Dias de trabalho atualizados!",
      description: "Suas configurações foram salvas com sucesso.",
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
          <div className="flex gap-2">
            {onEditPlanning && (
              <Button
                size="sm"
                variant="default"
                onClick={onEditPlanning}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar Metas
              </Button>
            )}
            {!isEditing ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Dias
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
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div className="space-y-3">
              <Label>Dias de trabalho</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Badge
                    key={day.key}
                    variant={workingDays.includes(day.key) ? "default" : "outline"}
                    className="cursor-pointer px-3 py-2 text-sm transition-all hover:scale-105"
                    onClick={() => toggleDay(day.key)}
                  >
                    {day.label}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {workingDays.length} {workingDays.length === 1 ? 'dia' : 'dias'} selecionados
              </p>
            </div>
            
            {/* Read-only goals display */}
            <div className="p-3 rounded-lg bg-muted/30 border border-muted/50">
              <p className="text-xs text-muted-foreground mb-2">
                💡 Para editar as metas, use o botão "Editar Metas" acima
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Meta mensal</p>
                  <p className="font-bold">{formatCurrency(monthlyGoal)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Meta diária</p>
                  <p className="font-bold">{formatCurrency(baseDailyGoal)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Meta semanal</p>
                  <p className="font-bold">{formatCurrency(weeklyGoal)}</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">📅 Dias de trabalho</p>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Badge
                    key={day.key}
                    variant={workingDays.includes(day.key) ? "default" : "outline"}
                    className="text-xs"
                  >
                    {day.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
          </>
        )}
      </CardContent>
    </Card>
  );
};