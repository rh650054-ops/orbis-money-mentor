import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Target, Clock, TrendingUp, Zap, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { getBrazilDate } from "@/lib/dateUtils";

interface DayStartPopupProps {
  userId: string;
  onStart: () => void;
  onEditPlanning: () => void;
}

type DayStatus = 'not_started' | 'in_progress' | 'finished';

// Chave de localStorage para controlar se o popup já foi visto hoje
const getSeenKey = (userId: string, today: string) =>
  `orbis_popup_seen_${userId}_${today}`;

export const DayStartPopup = ({ userId, onStart, onEditPlanning }: DayStartPopupProps) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyGoal, setDailyGoal] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(0);
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [workHours, setWorkHours] = useState(0);
  const [dayStatus, setDayStatus] = useState<DayStatus | null>(null);
  const [totalSold, setTotalSold] = useState(0);
  const [percentageAchieved, setPercentageAchieved] = useState(0);

  useEffect(() => {
    const today = getBrazilDate();
    const seenKey = getSeenKey(userId, today);

    // Só abre o popup se ainda não foi dispensado hoje
    const alreadySeen = localStorage.getItem(seenKey) === 'true';

    const init = async () => {
      await loadGoalsAndStatus();
      if (!alreadySeen) {
        setIsOpen(true);
      }
    };
    init();
  }, [userId]);

  const loadGoalsAndStatus = async () => {
    setIsLoading(true);
    const today = getBrazilDate();
    
    
    // Check work session status for today FIRST - this is the SOURCE OF TRUTH
    const { data: session, error: sessionError } = await supabase
      .from("work_sessions")
      .select("status, total_vendido")
      .eq("user_id", userId)
      .eq("planning_date", today)
      .maybeSingle();


    // Load profile goals
    const { data: profile } = await supabase
      .from("profiles")
      .select("base_daily_goal, weekly_goal, monthly_goal, goal_hours")
      .eq("user_id", userId)
      .single();

    if (profile) {
      setDailyGoal(profile.base_daily_goal || 0);
      setWeeklyGoal(profile.weekly_goal || 0);
      setMonthlyGoal(profile.monthly_goal || 0);
      setWorkHours(profile.goal_hours || 0);
    }

    // Determine day status based on session
    if (session) {
      if (session.status === 'finished') {
        setDayStatus('finished');
        setTotalSold(session.total_vendido || 0);
        if (profile?.base_daily_goal) {
          setPercentageAchieved(((session.total_vendido || 0) / profile.base_daily_goal) * 100);
        }
      } else if (session.status === 'active') {
        setDayStatus('in_progress');
      } else {
        setDayStatus('not_started');
      }
    } else {
      setDayStatus('not_started');
    }
    
    setIsLoading(false);
  };

  const markSeenToday = () => {
    const today = getBrazilDate();
    localStorage.setItem(getSeenKey(userId, today), 'true');
  };

  const handleStartDay = async () => {
    const today = getBrazilDate();
    // Cria ou atualiza a sessão de trabalho como 'active'
    await supabase
      .from("work_sessions")
      .upsert(
        {
          user_id: userId,
          planning_date: today,
          status: "active",
          start_timestamp: new Date().toISOString(),
          meta_dia: 0,
          ritmo_ideal_inicial: 0,
        },
        { onConflict: "user_id,planning_date" }
      );
    markSeenToday();
    setIsOpen(false);
    onStart();
  };

  const handleClose = () => {
    markSeenToday();
    setIsOpen(false);
  };

  const handleViewReport = () => {
    markSeenToday();
    setIsOpen(false);
    navigate('/daily-goals');
  };

  // Title based on day status
  const getTitle = () => {
    if (isLoading || dayStatus === null) return "⏳ Carregando...";
    if (dayStatus === 'finished') return "📊 Relatório do Dia";
    if (dayStatus === 'in_progress') return "⚡ Seu Dia em Andamento";
    return "⚡ Seu Dia Hoje";
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) markSeenToday(); setIsOpen(open); }}>
      <DialogContent
        className="w-[88vw] max-w-[360px] p-0 gap-0 overflow-hidden border border-border/60 bg-card rounded-2xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
      >
        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <DialogHeader className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {dayStatus === 'finished' ? 'Resumo' : dayStatus === 'in_progress' ? 'Em andamento' : 'Plano de hoje'}
            </p>
            <DialogTitle className="text-xl font-black text-foreground leading-tight">
              {getTitle().replace(/^[^\s]+\s/, '')}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {/* Resumo do dia (se finalizado) */}
          {dayStatus === 'finished' && (
            <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total vendido</p>
                <p className="text-xl font-black text-success leading-tight">{formatCurrency(totalSold)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">da meta</p>
                <p className="text-xl font-black text-foreground leading-tight">{percentageAchieved.toFixed(0)}%</p>
              </div>
            </div>
          )}

          {/* Meta de hoje — destaque sóbrio */}
          <div className="relative overflow-hidden rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary/70" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted/60 border border-border/60 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-foreground" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Meta de hoje</p>
                <p className="text-2xl font-black text-foreground leading-tight truncate">{formatCurrency(dailyGoal)}</p>
              </div>
            </div>
          </div>

          {/* Semana · Mês · Horas — linha compacta */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Zap className="w-3 h-3 text-muted-foreground" />
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Semana</p>
              </div>
              <p className="text-xs font-bold text-foreground truncate">{formatCurrency(weeklyGoal)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
              <div className="flex items-center gap-1 mb-0.5">
                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Mês</p>
              </div>
              <p className="text-xs font-bold text-foreground truncate">{formatCurrency(monthlyGoal)}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Horas</p>
              </div>
              <p className="text-xs font-bold text-foreground truncate">{workHours}h</p>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleClose}
              variant="ghost"
              className="h-10 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40"
            >
              Depois
            </Button>

            {!isLoading && dayStatus === 'not_started' && (
              <Button
                onClick={handleStartDay}
                className="relative overflow-hidden flex-1 h-10 bg-gradient-primary text-primary-foreground hover:opacity-95 font-bold text-sm rounded-lg group"
                style={{ boxShadow: "0 8px 24px -8px hsl(var(--primary) / 0.5)" }}
              >
                <span className="relative z-10">Iniciar meu dia</span>
                <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 animate-shine-sweep" />
              </Button>
            )}

            {!isLoading && dayStatus === 'in_progress' && (
              <Button
                onClick={handleViewReport}
                className="flex-1 h-10 bg-gradient-primary text-primary-foreground hover:opacity-90 font-bold text-sm rounded-lg"
                style={{ boxShadow: "0 8px 24px -8px hsl(var(--primary) / 0.6)" }}
              >
                ⚡ Continuar
              </Button>
            )}

            {!isLoading && dayStatus === 'finished' && (
              <Button
                onClick={handleViewReport}
                className="flex-1 h-10 bg-gradient-primary text-primary-foreground hover:opacity-90 font-bold text-sm rounded-lg"
                style={{ boxShadow: "0 8px 24px -8px hsl(var(--primary) / 0.6)" }}
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Ver relatório
              </Button>
            )}

            {isLoading && (
              <Button disabled className="flex-1 h-10 bg-muted text-muted-foreground font-semibold text-sm rounded-lg">
                Carregando...
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};