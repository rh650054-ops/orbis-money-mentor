import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Target, Clock, Zap, FileText, Flame, Rocket, Trophy, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/shared/lib/utils";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { useToast } from "@/shared/hooks/use-toast";

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
  const { toast } = useToast();
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
      .maybeSingle();

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
    const { error } = await supabase
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
    if (error) {
      toast({ title: "Erro ao iniciar o dia", description: error.message, variant: "destructive" });
      return;
    }
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
        className="w-[88vw] max-w-[360px] max-h-[92dvh] p-0 gap-0 overflow-hidden border border-primary/25 rounded-3xl shadow-[0_26px_70px_-20px_rgba(0,0,0,0.85)]"
        style={{ background: "radial-gradient(120% 80% at 50% -10%, rgba(246,180,10,0.10), transparent), #0c0c10" }}
      >
        <div className="pointer-events-none absolute -top-20 -right-16 w-48 h-48 rounded-full blur-3xl" style={{ background: "hsl(var(--primary) / 0.28)" }} />
        <div className="pointer-events-none absolute -bottom-24 -left-20 w-52 h-52 rounded-full blur-3xl" style={{ background: "rgba(79,216,245,0.16)" }} />
        {/* Header gamificado */}
        <div className="relative px-5 pt-6 pb-4 text-center">
          <div className="relative mx-auto mb-2 w-12 h-12">
            <div className="absolute inset-0 rounded-2xl blur-lg" style={{ background: "hsl(var(--primary) / 0.55)" }} />
            <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(180deg, hsl(45 100% 60%), hsl(var(--primary)))", boxShadow: "0 10px 26px -8px hsl(var(--primary) / 0.75)" }}>
              {dayStatus === 'finished'
                ? <Trophy className="w-6 h-6 text-[#1a1300]" strokeWidth={2.4} />
                : dayStatus === 'in_progress'
                ? <Flame className="w-6 h-6 text-[#1a1300]" strokeWidth={2.4} />
                : <Rocket className="w-6 h-6 text-[#1a1300]" strokeWidth={2.4} />}
            </div>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.26em]" style={{ color: "hsl(var(--primary))" }}>
            {dayStatus === 'finished' ? 'Missão cumprida' : dayStatus === 'in_progress' ? 'Missão em andamento' : 'Missão do dia'}
          </p>
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-2xl font-black text-foreground leading-tight">
              {getTitle().replace(/^[^\s]+\s/, '')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-1">
            {dayStatus === 'finished' ? 'Veja como foi o seu dia 👇' : dayStatus === 'in_progress' ? 'Você já começou. Mantém o ritmo! 🔥' : 'Bora bater a meta e subir no ranking 🔥'}
          </p>
        </div>

        <div className="relative z-10 px-5 pb-6 space-y-3.5">
          {/* Resumo do dia (se finalizado) */}
          {dayStatus === 'finished' && (
            <div className="rounded-2xl border border-success/40 bg-success/10 px-4 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total vendido</p>
                <p className="text-xl font-black text-success leading-tight">{formatCurrency(totalSold)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">da meta</p>
                <p className="text-xl font-black text-foreground leading-tight">{percentageAchieved.toFixed(0)}%</p>
              </div>
            </div>
          )}

          {/* Meta de hoje — destaque gamificado */}
          <div className="relative overflow-hidden rounded-2xl border px-4 py-4" style={{ borderColor: "hsl(var(--primary) / 0.4)", background: "linear-gradient(180deg, hsl(var(--primary) / 0.16), rgba(255,255,255,0.02))" }}>
            <div className="pointer-events-none absolute -right-6 -top-8 w-28 h-28 rounded-full blur-2xl" style={{ background: "hsl(var(--primary) / 0.3)" }} />
            <div className="relative flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "hsl(var(--primary) / 0.2)", border: "1px solid hsl(var(--primary) / 0.45)" }}>
                <Target className="w-6 h-6" style={{ color: "hsl(var(--primary))" }} strokeWidth={2.4} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-black">Meta de hoje</p>
                <p className="text-[32px] font-black leading-none truncate" style={{ color: "hsl(var(--primary))", textShadow: "0 0 26px hsl(var(--primary) / 0.45)" }}>{formatCurrency(dailyGoal)}</p>
              </div>
            </div>
          </div>

          {/* Semana · Mês · Horas — cards coloridos */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl p-2.5 text-center border" style={{ borderColor: "rgba(79,216,245,0.35)", background: "rgba(79,216,245,0.10)" }}>
              <div className="w-7 h-7 mx-auto rounded-lg flex items-center justify-center mb-1.5" style={{ background: "rgba(79,216,245,0.18)" }}>
                <Zap className="w-3.5 h-3.5" style={{ color: "#4FD8F5" }} />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Semana</p>
              <p className="text-[13px] font-black text-foreground truncate">{formatCurrency(weeklyGoal)}</p>
            </div>
            <div className="rounded-xl p-2.5 text-center border" style={{ borderColor: "rgba(180,124,255,0.35)", background: "rgba(180,124,255,0.10)" }}>
              <div className="w-7 h-7 mx-auto rounded-lg flex items-center justify-center mb-1.5" style={{ background: "rgba(180,124,255,0.18)" }}>
                <CalendarDays className="w-3.5 h-3.5" style={{ color: "#B47CFF" }} />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Mês</p>
              <p className="text-[13px] font-black text-foreground truncate">{formatCurrency(monthlyGoal)}</p>
            </div>
            <div className="rounded-xl p-2.5 text-center border" style={{ borderColor: "rgba(246,180,10,0.35)", background: "rgba(246,180,10,0.10)" }}>
              <div className="w-7 h-7 mx-auto rounded-lg flex items-center justify-center mb-1.5" style={{ background: "rgba(246,180,10,0.18)" }}>
                <Clock className="w-3.5 h-3.5" style={{ color: "#F6B40A" }} />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Horas</p>
              <p className="text-[13px] font-black text-foreground truncate">{workHours}h</p>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1.5">
            <Button
              onClick={handleClose}
              variant="ghost"
              className="h-12 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40"
            >
              Depois
            </Button>

            {!isLoading && dayStatus === 'not_started' && (
              <Button
                onClick={handleStartDay}
                className="relative overflow-hidden flex-1 h-12 text-primary-foreground font-black text-[15px] rounded-xl active:scale-[0.98] transition-transform"
                style={{ background: "linear-gradient(180deg, hsl(45 100% 58%), hsl(var(--primary)))", boxShadow: "0 12px 30px -8px hsl(var(--primary) / 0.7)" }}
              >
                <Rocket className="w-4 h-4 mr-1.5" strokeWidth={2.6} />
                Iniciar meu dia
              </Button>
            )}

            {!isLoading && dayStatus === 'in_progress' && (
              <Button
                onClick={handleViewReport}
                className="flex-1 h-12 text-primary-foreground font-black text-[15px] rounded-xl active:scale-[0.98] transition-transform"
                style={{ background: "linear-gradient(180deg, hsl(45 100% 58%), hsl(var(--primary)))", boxShadow: "0 12px 30px -8px hsl(var(--primary) / 0.7)" }}
              >
                <Flame className="w-4 h-4 mr-1.5" strokeWidth={2.6} />
                Continuar
              </Button>
            )}

            {!isLoading && dayStatus === 'finished' && (
              <Button
                onClick={handleViewReport}
                className="flex-1 h-12 text-primary-foreground font-black text-[15px] rounded-xl active:scale-[0.98] transition-transform"
                style={{ background: "linear-gradient(180deg, hsl(45 100% 58%), hsl(var(--primary)))", boxShadow: "0 12px 30px -8px hsl(var(--primary) / 0.7)" }}
              >
                <FileText className="w-4 h-4 mr-1.5" />
                Ver relatório
              </Button>
            )}

            {isLoading && (
              <Button disabled className="flex-1 h-12 bg-muted text-muted-foreground font-semibold text-sm rounded-xl">
                Carregando...
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};