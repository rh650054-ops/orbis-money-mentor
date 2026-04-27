import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Clock, Calendar, CalendarCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";

interface EditPlanningModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  isRequired?: boolean;
  requiredReason?: "first_time" | "new_month" | null;
}

export function EditPlanningModal({ userId, isOpen, onClose, isRequired = false, requiredReason = null }: EditPlanningModalProps) {
  const { toast } = useToast();
  const [monthlyGoal, setMonthlyGoal] = useState(4200);
  const [workHours, setWorkHours] = useState(8);
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(5);
  const [loading, setLoading] = useState(false);
  const { isConnected, googleEmail, loading: calendarLoading, connect, disconnect } = useGoogleCalendar(userId);

  useEffect(() => {
    if (isOpen) {
      loadCurrentData();
    }
  }, [isOpen, userId]);

  const loadCurrentData = async () => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("monthly_goal, goal_hours, weekly_work_days")
      .eq("user_id", userId)
      .single();

    if (profile) {
      setMonthlyGoal(profile.monthly_goal || 4200);
      setWorkHours(profile.goal_hours || 8);
      setWorkDaysPerWeek(profile.weekly_work_days || 5);
    }
  };

  const calculateDailyGoal = () => {
    const workDaysInMonth = workDaysPerWeek * 4;
    return monthlyGoal / workDaysInMonth;
  };

  const calculateWeeklyGoal = () => {
    return calculateDailyGoal() * workDaysPerWeek;
  };

  const handleSave = async () => {
    if (workDaysPerWeek <= 0 || workHours <= 0 || monthlyGoal <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos corretamente.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const dailyGoal = calculateDailyGoal();
    const weeklyGoal = calculateWeeklyGoal();
    const hourlyGoal = dailyGoal / workHours;

    // Update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        monthly_goal: monthlyGoal,
        goal_hours: workHours,
        weekly_work_days: workDaysPerWeek,
        base_daily_goal: dailyGoal,
        weekly_goal: weeklyGoal,
        week_start_date: new Date().toISOString().split('T')[0],
      })
      .eq("user_id", userId);

    if (profileError) {
      toast({
        title: "Erro ao salvar",
        description: profileError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Update today's plan if exists
    const today = new Date().toISOString().split('T')[0];
    const { data: todayPlan } = await supabase
      .from("daily_goal_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .single();

    if (todayPlan) {
      await supabase
        .from("daily_goal_plans")
        .update({
          daily_goal: dailyGoal,
          work_hours: workHours,
          hourly_goal: hourlyGoal,
        })
        .eq("id", todayPlan.id);

      // Update hourly blocks
      const { data: blocks } = await supabase
        .from("hourly_goal_blocks")
        .select("*")
        .eq("plan_id", todayPlan.id);

      if (blocks) {
        // If hours changed, recreate blocks
        if (blocks.length !== workHours) {
          // Delete old blocks
          await supabase
            .from("hourly_goal_blocks")
            .delete()
            .eq("plan_id", todayPlan.id);

          // Create new blocks
          const newBlocks = Array.from({ length: workHours }, (_, i) => ({
            plan_id: todayPlan.id,
            user_id: userId,
            hour_index: i,
            hour_label: `H${i + 1}`,
            target_amount: hourlyGoal,
          }));

          await supabase
            .from("hourly_goal_blocks")
            .insert(newBlocks);
        } else {
          // Just update target amounts
          for (const block of blocks) {
            if (!block.is_completed) {
              await supabase
                .from("hourly_goal_blocks")
                .update({ target_amount: hourlyGoal })
                .eq("id", block.id);
            }
          }
        }
      }
    }

    setLoading(false);
    toast({
      title: "✅ Planejamento atualizado!",
      description: "Suas metas foram atualizadas com sucesso.",
    });
    onClose();
  };

  const dailyGoal = calculateDailyGoal();
  const weeklyGoal = calculateWeeklyGoal();
  const hourlyGoal = workHours > 0 ? dailyGoal / workHours : 0;

  // Get title and description based on required reason
  const getTitle = () => {
    if (requiredReason === "first_time") {
      return "🎯 Configure seu Planejamento";
    }
    if (requiredReason === "new_month") {
      return "📅 Novo Mês - Atualize suas Metas";
    }
    return "✏️ Editar Planejamento";
  };

  const getDescription = () => {
    if (requiredReason === "first_time") {
      return "Defina sua meta deste mês, suas horas de trabalho por dia e quantos dias irá trabalhar.";
    }
    if (requiredReason === "new_month") {
      return "É dia 1! Configure suas metas para este novo mês.";
    }
    return "Ajuste sua meta mensal, horas e dias de trabalho";
  };

  // Handle close - only allow if not required
  const handleOpenChange = (open: boolean) => {
    if (!open && isRequired) {
      toast({
        title: "⚠️ Configuração obrigatória",
        description: "Você precisa configurar seu planejamento para continuar usando o app.",
        variant: "destructive",
      });
      return;
    }
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-w-[420px] sm:max-w-[440px] p-0 gap-0 bg-card border border-border rounded-2xl overflow-hidden"
      >
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-lg font-bold text-primary leading-tight">
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-3">
          {isRequired && (
            <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-primary/90">
                {requiredReason === "first_time"
                  ? "Configure seu planejamento para começar."
                  : "Defina suas metas para este novo mês."}
              </p>
            </div>
          )}

          {/* Inputs em grid compacto */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="monthlyGoal" className="flex items-center gap-1.5 text-xs">
                <Target className="w-3.5 h-3.5 text-primary" />
                Meta Mensal (R$)
              </Label>
              <Input
                id="monthlyGoal"
                type="number"
                inputMode="numeric"
                value={monthlyGoal || ''}
                onChange={(e) => setMonthlyGoal(e.target.value === '' ? 0 : Number(e.target.value))}
                onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                min={1}
                placeholder="Ex: 4200"
                className="h-10 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="workDays" className="flex items-center gap-1.5 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  Dias/semana
                </Label>
                <Input
                  id="workDays"
                  type="number"
                  inputMode="numeric"
                  value={workDaysPerWeek || ''}
                  onChange={(e) => setWorkDaysPerWeek(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                  min={1}
                  max={7}
                  placeholder="5"
                  className="h-10 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="workHours" className="flex items-center gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Horas/dia
                </Label>
                <Input
                  id="workHours"
                  type="number"
                  inputMode="numeric"
                  value={workHours || ''}
                  onChange={(e) => setWorkHours(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                  min={1}
                  max={24}
                  placeholder="8"
                  className="h-10 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Resumo compacto */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="min-w-0">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Semanal</p>
                <p className="text-xs font-bold text-foreground truncate">{formatCurrency(weeklyGoal)}</p>
              </div>
              <div className="min-w-0 border-x border-border">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Diária</p>
                <p className="text-xs font-bold text-primary truncate">{formatCurrency(dailyGoal)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Por Hora</p>
                <p className="text-xs font-bold text-foreground truncate">{formatCurrency(hourlyGoal)}</p>
              </div>
            </div>
          </div>

          {/* Google Calendar — link discreto */}
          {!isRequired && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">Google Calendar</p>
                  {isConnected && (
                    <p className="text-[10px] text-muted-foreground truncate">{googleEmail}</p>
                  )}
                </div>
              </div>
              {isConnected ? (
                <Button
                  onClick={disconnect}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-destructive hover:bg-destructive/10"
                >
                  Desconectar
                </Button>
              ) : (
                <Button
                  onClick={connect}
                  disabled={calendarLoading}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-primary hover:bg-primary/10"
                >
                  {calendarLoading ? "..." : "Conectar"}
                </Button>
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            {!isRequired && (
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 h-10 rounded-lg border-border"
                disabled={loading}
              >
                Cancelar
              </Button>
            )}
            <Button
              onClick={handleSave}
              className="flex-1 h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={loading}
            >
              {loading ? "Salvando..." : isRequired ? "Começar" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
