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
        className="w-[calc(100vw-1rem)] max-w-[500px] sm:w-full p-0 gap-0 bg-[#0D0D0D] border border-[#F4A100]/20 rounded-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]"
      >
        <DialogHeader
          className="px-5 pt-5 pb-3 border-b border-white/5 shrink-0"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}
        >
          <DialogTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#F4A100] to-[#6B21A8] bg-clip-text text-transparent leading-tight">
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5"
        >
          {isRequired && (
            <div className="p-3 rounded-xl bg-[#F4A100]/10 border border-[#F4A100]/30 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-[#F4A100] mt-0.5 shrink-0" />
              <p className="text-sm text-[#F4A100]/90">
                {requiredReason === "first_time"
                  ? "Configure seu planejamento para começar a usar o Orbis."
                  : "Defina suas metas para este novo mês antes de continuar."}
              </p>
            </div>
          )}

          {/* Meta Mensal */}
          <div className="space-y-2">
            <Label htmlFor="monthlyGoal" className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-[#F4A100]" />
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
              className="h-12 rounded-xl border-white/10 bg-[#1A1A1A] focus-visible:border-[#F4A100] focus-visible:ring-[#F4A100]/20"
            />
          </div>

          {/* Dias por semana */}
          <div className="space-y-2">
            <Label htmlFor="workDays" className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-[#6B21A8]" />
              Dias de trabalho por semana
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
              placeholder="Ex: 5"
              className="h-12 rounded-xl border-white/10 bg-[#1A1A1A] focus-visible:border-[#6B21A8] focus-visible:ring-[#6B21A8]/20"
            />
          </div>

          {/* Horas por dia */}
          <div className="space-y-2">
            <Label htmlFor="workHours" className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-[#F4A100]" />
              Horas de trabalho por dia
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
              placeholder="Ex: 8"
              className="h-12 rounded-xl border-white/10 bg-[#1A1A1A] focus-visible:border-[#F4A100] focus-visible:ring-[#F4A100]/20"
            />
          </div>

          {/* Preview das metas */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#F4A100]/10 to-[#6B21A8]/10 border border-[#F4A100]/20 space-y-3">
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">📊 Resumo Calculado</p>
            <div className="grid grid-cols-3 gap-2 text-xs sm:text-sm">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px] sm:text-xs">Semanal</p>
                <p className="font-bold text-[#F4A100] truncate">{formatCurrency(weeklyGoal)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px] sm:text-xs">Diária</p>
                <p className="font-bold text-white truncate">{formatCurrency(dailyGoal)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px] sm:text-xs">Por Hora</p>
                <p className="font-bold text-[#6B21A8] truncate">{formatCurrency(hourlyGoal)}</p>
              </div>
            </div>
          </div>

          {/* Google Calendar Integration */}
          {!isRequired && (
            <div className="p-4 rounded-xl bg-[#1A1A1A] border border-[#6B21A8]/20 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-[#6B21A8]" />
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Google Calendar</p>
              </div>

              {isConnected ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">Conectado</p>
                    <p className="text-xs text-muted-foreground truncate">{googleEmail}</p>
                  </div>
                  <Button
                    onClick={disconnect}
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    Desconectar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Sincronize automaticamente suas metas e lembretes
                  </p>
                  <Button
                    onClick={connect}
                    disabled={calendarLoading}
                    size="sm"
                    className="w-full bg-[#6B21A8] hover:bg-[#6B21A8]/80 text-white"
                  >
                    {calendarLoading ? "Conectando..." : "🔗 Conectar Google Calendar"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botões fixos no rodapé */}
        <div
          className="px-5 py-4 border-t border-white/5 bg-[#0D0D0D] shrink-0 flex gap-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          {!isRequired && (
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-12 rounded-xl border-white/10 bg-transparent hover:bg-white/5"
              disabled={loading}
            >
              Cancelar
            </Button>
          )}
          <Button
            onClick={handleSave}
            className="flex-1 h-12 rounded-xl bg-[#F4A100] hover:bg-[#F4A100]/90 text-black font-semibold"
            disabled={loading}
          >
            {loading ? "Salvando..." : isRequired ? "🚀 Começar" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
