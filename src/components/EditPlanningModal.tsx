import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/shared/ui/dialog";
import { MoneyInput } from "@/shared/ui/money-input";
import { emitMissionEvent } from "@/shared/lib/missionEvents";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { getBrazilDate } from "@/shared/lib/date-utils";
import CampoHoraVenda from "@/components/CampoHoraVenda";

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
      .maybeSingle();

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
        week_start_date: getBrazilDate(),
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
    const today = getBrazilDate();
    const { data: todayPlan } = await supabase
      .from("daily_goal_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

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
    emitMissionEvent("goal-set");
    onClose();
  };

  const dailyGoal = calculateDailyGoal();
  const weeklyGoal = calculateWeeklyGoal();
  const hourlyGoal = workHours > 0 ? dailyGoal / workHours : 0;

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

  // ---- Orbis 2.0: chips pra dias/horas. Valor fora da lista (ex.: 13h) vira chip extra.
  const opcoesDias = [4, 5, 6, 7].includes(workDaysPerWeek) ? [4, 5, 6, 7] : [...new Set([4, 5, 6, 7, workDaysPerWeek])].filter(Boolean).sort((a, b) => a - b);
  const opcoesHoras = [6, 8, 10, 12].includes(workHours) ? [6, 8, 10, 12] : [...new Set([6, 8, 10, 12, workHours])].filter(Boolean).sort((a, b) => a - b);
  const fmt0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

  const Chip = ({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className="orbis-press orbis-num flex-1 h-11 rounded-[13px] flex items-center justify-center text-[15px] font-extrabold"
      style={ativo
        ? { background: "linear-gradient(180deg,var(--orbis-gold-light,#FFC63A),var(--orbis-gold,#F5B800))", color: "#1A1200", boxShadow: "0 4px 0 var(--orbis-gold-deep,#B88700)" }
        : { background: "#101010", border: "1px solid var(--orbis-line, rgba(255,255,255,.09))", color: "var(--orbis-fg-2, #B9B3A6)" }}
    >
      {children}
    </button>
  );
  const Rotulo = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10.5px] font-extrabold uppercase tracking-[.16em] text-left" style={{ color: "var(--orbis-fg-3, #7E7869)" }}>{children}</p>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-[420px] p-0 gap-0 border rounded-[22px] overflow-hidden"
        style={{
          background: "linear-gradient(160deg,#17130A 0%,var(--orbis-surface,#111) 55%)",
          borderColor: "rgba(245,184,0,.30)",
          boxShadow: "0 24px 70px -24px rgba(245,184,0,.4)",
        }}
      >
        <DialogHeader className="px-5 pt-5 pb-1 text-left">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em]" style={{ color: "var(--orbis-gold,#F5B800)" }}>
            {requiredReason === "new_month" ? "Novo mês" : "Seu planejamento"}
          </p>
          <DialogTitle className="font-display text-[19px] font-extrabold leading-tight mt-0.5">
            {requiredReason === "first_time" ? "Monte seu planejamento" : requiredReason === "new_month" ? "Atualize suas metas" : "Meta, ritmo e combinado"}
          </DialogTitle>
          <DialogDescription className="text-[12px] mt-1" style={{ color: "var(--orbis-fg-2,#B9B3A6)" }}>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5 pt-3 flex flex-col gap-3.5">
          {isRequired && (
            <div className="rounded-xl px-3 py-2.5 flex items-start gap-2" style={{ background: "var(--orbis-gold-soft, rgba(245,184,0,.13))", border: "1px solid rgba(245,184,0,.35)" }}>
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--orbis-gold,#F5B800)" }} />
              <p className="text-[12px]" style={{ color: "var(--orbis-fg,#F4F1EA)" }}>
                {requiredReason === "first_time"
                  ? "Configure seu planejamento para começar."
                  : "Defina suas metas para este novo mês."}
              </p>
            </div>
          )}

          <div>
            <Rotulo>Meta mensal</Rotulo>
            <div className="mt-[6px] rounded-2xl px-4 py-1 flex items-center" style={{ background: "#101010", border: "1px solid rgba(245,184,0,.35)" }}>
              <MoneyInput
                id="monthlyGoal"
                value={monthlyGoal}
                onChange={setMonthlyGoal}
                decimals={0}
                placeholder="Ex: 6.000"
                className="orbis-num font-display h-11 border-0 bg-transparent px-0 text-[22px] font-extrabold focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Rotulo>Dias/semana</Rotulo>
              <div className="mt-[6px] flex gap-1.5">
                {opcoesDias.map((d) => (
                  <Chip key={d} ativo={workDaysPerWeek === d} onClick={() => setWorkDaysPerWeek(d)}>{d}</Chip>
                ))}
              </div>
            </div>
            <div>
              <Rotulo>Horas/dia</Rotulo>
              <div className="mt-[6px] flex gap-1.5">
                {opcoesHoras.map((h) => (
                  <Chip key={h} ativo={workHours === h} onClick={() => setWorkHours(h)}>{h}</Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Faixa gerada ao vivo — a mesma conta de sempre (mês ÷ 4) */}
          <div className="rounded-2xl border px-3 py-3 grid grid-cols-3 text-center"
            style={{ borderColor: "rgba(245,184,0,.4)", background: "var(--orbis-gold-soft, rgba(245,184,0,.10))" }}>
            <div>
              <p className="text-[9.5px] font-extrabold uppercase tracking-[.12em]" style={{ color: "var(--orbis-fg-3,#7E7869)" }}>Semanal</p>
              <p className="orbis-num font-display text-[15px] font-extrabold mt-1">{fmt0(weeklyGoal)}</p>
            </div>
            <div style={{ borderLeft: "1px solid rgba(255,255,255,.10)", borderRight: "1px solid rgba(255,255,255,.10)" }}>
              <p className="text-[9.5px] font-extrabold uppercase tracking-[.12em]" style={{ color: "var(--orbis-gold,#F5B800)" }}>Diária</p>
              <p className="orbis-num font-display text-[15px] font-extrabold mt-1" style={{ color: "var(--orbis-gold,#F5B800)" }}>{fmt0(dailyGoal)}</p>
            </div>
            <div>
              <p className="text-[9.5px] font-extrabold uppercase tracking-[.12em]" style={{ color: "var(--orbis-fg-3,#7E7869)" }}>Por hora</p>
              <p className="orbis-num font-display text-[15px] font-extrabold mt-1">{fmt0(hourlyGoal)}</p>
            </div>
          </div>

          {/* Que horas começa a vender amanhã? — grava sozinho; a cobrança lê daqui */}
          <CampoHoraVenda userId={userId} />

          {/* Botões */}
          <div className="flex gap-2.5 pt-1">
            {!isRequired && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="orbis-press flex-1 h-[46px] rounded-2xl text-[14px] font-bold"
                style={{ border: "1px solid var(--orbis-line, rgba(255,255,255,.12))", color: "var(--orbis-fg,#F4F1EA)" }}
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="orbis-cta flex-1"
              style={{ height: 46 }}
            >
              {loading ? "Salvando..." : isRequired ? "Começar" : "Salvar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
