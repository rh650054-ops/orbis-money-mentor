import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Zap, FileText, Check, Play } from "lucide-react";
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
        setTotalSold(session.total_vendido || 0);
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

  /* VISUAL NO PADRÃO VANT (Rick, 03/10): o mesmo card da Foco — preto, a borda e
     o rótulo mudam de cor com o momento (vermelho antes, verde rodando, dourado
     fechado), número grande, barra, linha SEMANA · MÊS · HORAS e o botão 3D. */
  const tom = dayStatus === "finished"
    ? { cor: "#F5B800", borda: "rgba(245,184,0,.38)", fundo: "radial-gradient(120% 80% at 80% -10%, rgba(245,184,0,.20), transparent 60%), linear-gradient(170deg,#1a1408 0%,#0b0b0b 70%)" }
    : dayStatus === "in_progress"
    ? { cor: "#3DD68C", borda: "rgba(61,214,140,.38)", fundo: "radial-gradient(120% 80% at 80% -10%, rgba(61,214,140,.18), transparent 60%), linear-gradient(170deg,#0a1711 0%,#0b0b0b 70%)" }
    : { cor: "#F2465A", borda: "rgba(242,70,90,.38)", fundo: "radial-gradient(120% 80% at 80% -10%, rgba(242,70,90,.22), transparent 60%), linear-gradient(170deg,#170a0c 0%,#0b0b0b 70%)" };
  const brl0 = (v: number) => formatCurrency(v).replace(/,00$/, "");
  const ritmo = workHours > 0 ? dailyGoal / workHours : 0;
  const pct = Math.max(0, Math.min(100, dayStatus === "finished" ? percentageAchieved : dailyGoal > 0 ? (totalSold / dailyGoal) * 100 : 0));
  const titulo = isLoading || dayStatus === null ? "Carregando…" : dayStatus === "finished" ? "Dia fechado." : dayStatus === "in_progress" ? "Tá rodando." : "Bora pro corre.";
  const tag = dayStatus === "finished" ? "DEFCON 4 · ENCERRADO" : dayStatus === "in_progress" ? "DEFCON 4 · AO VIVO" : "DEFCON 4 · MISSÃO DO DIA";
  const numero = dayStatus === "finished" || (dayStatus === "in_progress" && totalSold > 0) ? totalSold : dailyGoal;
  const rotuloNumero = dayStatus === "finished" ? "Vendido hoje" : dayStatus === "in_progress" && totalSold > 0 ? "Vendido até agora" : "Meta de hoje";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) markSeenToday(); setIsOpen(open); }}>
      <DialogContent
        className="w-[90vw] max-w-[380px] max-h-[92dvh] p-0 gap-0 overflow-hidden rounded-[26px] border shadow-[0_30px_80px_-24px_rgba(0,0,0,.95)]"
        style={{ borderColor: tom.borda, background: tom.fundo }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-5 pt-5 pb-5">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[.2em] uppercase" style={{ color: tom.cor }}>
            {dayStatus === "in_progress"
              ? <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#3DD68C", boxShadow: "0 0 0 4px rgba(61,214,140,.18)" }} />
              : dayStatus === "finished" ? <Check className="w-3 h-3" strokeWidth={3} /> : <Zap className="w-3 h-3" fill="currentColor" strokeWidth={0} />}
            {tag}
          </span>
          <DialogHeader className="space-y-0 text-left">
            <DialogTitle className="font-display text-[24px] font-extrabold tracking-tight leading-tight mt-2 text-left">{titulo}</DialogTitle>
          </DialogHeader>

          <p className="orbis-mini mt-4">{rotuloNumero}</p>
          <p className="orbis-num text-[40px] font-extrabold leading-none mt-1.5 tracking-[-1px]" style={dayStatus === "not_started" || dayStatus === null ? undefined : { color: "var(--orbis-ok, #3DD68C)" }}>
            {brl0(numero)}
          </p>
          <p className="text-[12.5px] mt-2" style={{ color: "var(--orbis-fg-2, #b9b3a6)" }}>
            {dayStatus === "finished"
              ? <><b className="text-foreground">{Math.round(percentageAchieved)}%</b> da meta de {brl0(dailyGoal)}</>
              : dayStatus === "in_progress" && totalSold > 0
              ? <>Meta <b className="text-foreground">{brl0(dailyGoal)}</b> · falta <b className="text-foreground">{brl0(Math.max(0, dailyGoal - totalSold))}</b></>
              : workHours > 0
              ? <><b className="text-foreground">{workHours} blocos</b> de 1h · ritmo de <b className="text-foreground">{brl0(ritmo)}</b> por hora</>
              : "Quem vende mais sobe no ranking."}
          </p>
          <div className="h-1.5 rounded-full mt-3.5 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: dayStatus === "not_started" ? "linear-gradient(90deg,#F5B800,#FFC63A)" : "linear-gradient(90deg,#3DD68C,#46E09A)" }} />
          </div>

          {/* SEMANA · MÊS · HORAS — mesma linha de números da Foco */}
          <div className="flex mt-4 pt-3.5 border-t" style={{ borderColor: "rgba(255,255,255,.09)" }}>
            {([["Semana", brl0(weeklyGoal)], ["Mês", brl0(monthlyGoal)], ["Horas", `${workHours}h`]] as const).map(([k, v], i) => (
              <div key={k} className={`flex-1 min-w-0 ${i ? "border-l pl-3" : ""}`} style={i ? { borderColor: "rgba(255,255,255,.09)" } : undefined}>
                <p className="text-[9.5px] font-bold uppercase tracking-[.08em]" style={{ color: "var(--orbis-fg-3, #7b766e)" }}>{k}</p>
                <p className="orbis-num text-[15px] font-bold mt-1 whitespace-nowrap truncate">{v}</p>
              </div>
            ))}
          </div>

          {isLoading ? (
            <button type="button" disabled className="w-full h-[54px] rounded-[16px] mt-5 text-[14px] font-bold" style={{ background: "#16151a", color: "#7b766e" }}>Carregando…</button>
          ) : dayStatus === "in_progress" ? (
            <button type="button" onClick={handleViewReport} className="w-full h-[54px] rounded-[17px] mt-5 font-extrabold text-[15.5px] flex items-center justify-center gap-2 active:scale-[.98] transition"
              style={{ background: "linear-gradient(180deg,#46E09A,#3DD68C)", color: "#06170e", boxShadow: "0 12px 28px -12px rgba(61,214,140,.8)" }}>
              <Play className="w-[17px] h-[17px]" fill="#06170e" strokeWidth={0} /> VOLTAR PRO DEFCON
            </button>
          ) : dayStatus === "finished" ? (
            <button type="button" onClick={handleViewReport} className="orbis-cta w-full mt-5"><FileText className="w-4 h-4" strokeWidth={2.4} /> VER O RELATÓRIO DE HOJE</button>
          ) : (
            <button type="button" onClick={handleStartDay} className="w-full h-[54px] rounded-[17px] mt-5 font-extrabold text-[15.5px] tracking-wide flex items-center justify-center gap-2 active:scale-[.98] transition"
              style={{ background: "linear-gradient(180deg,#F2465A,#E5354A)", color: "#fff", boxShadow: "0 12px 28px -10px rgba(229,53,74,.9)" }}>
              <Zap className="w-[17px] h-[17px]" fill="#fff" strokeWidth={0} /> INICIAR MEU DIA
            </button>
          )}
          <button type="button" onClick={handleClose} className="w-full h-10 mt-1.5 text-[12.5px] font-bold" style={{ color: "var(--orbis-fg-3, #7b766e)" }}>agora não</button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
