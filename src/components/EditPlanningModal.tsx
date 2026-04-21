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
      <DialogContent className="sm:max-w-[500px] bg-black/95 backdrop-blur-xl border border-white/10">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        {isRequired && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-sm text-yellow-200">
              {requiredReason === "first_time" 
                ? "Configure seu planejamento para começar a usar o Orbis."
                : "Defina suas metas para este novo mês antes de continuar."}
            </p>
          </div>
        )}

        <div className="space-y-6 py-4">
          {/* Meta Mensal */}
          <div className="space-y-2">
            <Label htmlFor="monthlyGoal" className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              Meta Mensal (R$)
            </Label>
            <Input
              id="monthlyGoal"
              type="number"
              value={monthlyGoal || ''}
              onChange={(e) => setMonthlyGoal(e.target.value === '' ? 0 : Number(e.target.value))}
              onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
              min={1}
              placeholder="Ex: 4200"
              className="h-12 border-white/10 bg-white/5 focus:border-blue-500"
            />
          </div>

          {/* Dias por semana */}
          <div className="space-y-2">
            <Label htmlFor="workDays" className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-500" />
              Quantos dias vai trabalhar na semana?
            </Label>
            <Input
              id="workDays"
              type="number"
              value={workDaysPerWeek || ''}
              onChange={(e) => setWorkDaysPerWeek(e.target.value === '' ? 0 : Number(e.target.value))}
              onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
              min={1}
              max={7}
              placeholder="Ex: 5"
              className="h-12 border-white/10 bg-white/5 focus:border-green-500"
            />
          </div>

          {/* Horas por dia */}
          <div className="space-y-2">
            <Label htmlFor="workHours" className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              Quantas horas vai trabalhar por dia?
            </Label>
            <Input
              id="workHours"
              type="number"
              value={workHours || ''}
              onChange={(e) => setWorkHours(e.target.value === '' ? 0 : Number(e.target.value))}
              onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
              min={1}
              max={24}
              placeholder="Ex: 8"
              className="h-12 border-white/10 bg-white/5 focus:border-orange-500"
            />
          </div>

          {/* Preview das metas */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 border border-blue-500/20 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">📊 Resumo Calculado</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Meta Semanal:</p>
                <p className="font-bold text-green-500">{formatCurrency(weeklyGoal)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Meta Diária:</p>
                <p className="font-bold text-blue-500">{formatCurrency(dailyGoal)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Meta por Hora:</p>
                <p className="font-bold text-orange-500">{formatCurrency(hourlyGoal)}</p>
              </div>
            </div>
          </div>

          {/* Google Calendar Integration - only show when not in required mode */}
          {!isRequired && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-600/10 border border-purple-500/20 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-purple-400" />
                <p className="text-xs text-muted-foreground uppercase tracking-wide">📅 Google Calendar</p>
              </div>
              
              {isConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">Conectado</p>
                      <p className="text-xs text-muted-foreground">{googleEmail}</p>
                    </div>
                    <Button
                      onClick={disconnect}
                      variant="outline"
                      size="sm"
                      className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                    >
                      Desconectar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Conecte seu Google Calendar para sincronizar automaticamente suas metas e receber lembretes
                  </p>
                  <Button
                    onClick={connect}
                    disabled={calendarLoading}
                    size="sm"
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                  >
                    {calendarLoading ? "Conectando..." : "🔗 Conectar Google Calendar"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            {!isRequired && (
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 h-12 border-white/10 hover:bg-white/5"
                disabled={loading}
              >
                Cancelar
              </Button>
            )}
            <Button
              onClick={handleSave}
              className={`h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 font-semibold ${isRequired ? 'flex-1' : 'flex-1'}`}
              disabled={loading}
            >
              {loading ? "Salvando..." : isRequired ? "🚀 Começar" : "💾 Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
