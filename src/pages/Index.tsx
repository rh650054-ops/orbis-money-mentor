import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/shared/ui/card";
import { Pencil } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useDailyGoalPlan } from "@/hooks/useDailyGoalPlan";
import { supabase } from "@/integrations/supabase/client";
import AntiProcrastination from "@/components/AntiProcrastination";
import { formatCurrency } from "@/shared/lib/utils";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { useRefetchOnFocus } from "@/shared/hooks/use-refetch-on-focus";
import CardRegistrationModal from "@/components/CardRegistrationModal";
import { TrialNudge } from "@/components/TrialNudge";
import { EditPlanningModal } from "@/components/EditPlanningModal";
import { emitMissionEvent } from "@/shared/lib/missionEvents";
import { DayStartPopup } from "@/components/DayStartPopup";
import RankingCard from "@/components/RankingCard";
import CompetitionCard from "@/components/CompetitionCard";
import X1InvitePopup from "@/components/competitions/X1InvitePopup";
import { useMonthlyGoalRequired } from "@/hooks/useMonthlyGoalRequired";

const REWARD_TIERS = [
  { name: "Semente", emoji: "🌱", threshold: 10_000, accent: "140 70% 45%", rarity: "Comum" },
  { name: "Brasa", emoji: "🔥", threshold: 50_000, accent: "25 95% 55%", rarity: "Incomum" },
  { name: "Forja", emoji: "⚒️", threshold: 100_000, accent: "45 95% 55%", rarity: "Raro" },
  { name: "Lenda", emoji: "⭐", threshold: 1_000_000, accent: "200 90% 60%", rarity: "Lendário" },
] as const;

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { hasPlanToday, loading: planLoading } = useDailyGoalPlan(user?.id);
  const { toast } = useToast();

  // Avisa o splash de abertura que a tela inicial já montou, pra ele sair só
  // quando o app estiver pronto (evita a barra de baixo "piscar" antes).
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("orbis:ready")));
    return () => cancelAnimationFrame(id);
  }, []);
  const [todaySales, setTodaySales] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    totalCost: 0,
    totalTransport: 0,
    totalFood: 0,
    balance: 0,
    variation: 0
  });
  const [monthlyGoal, setMonthlyGoal] = useState(4200);
  const [dailyGoalPlan, setDailyGoalPlan] = useState(0); // meta do dia definida pelo usuário (mesma do DEFCON / daily_goal_plans)
  const [nickname, setNickname] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterType, setFilterType] = useState<"day" | "week" | "month" | "all" | "custom">("month");
  const [salesCountToday, setSalesCountToday] = useState(0);
  const [monthExpensesTotal, setMonthExpensesTotal] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dailyAverage, setDailyAverage] = useState(0);
  const [activeDaysCount, setActiveDaysCount] = useState(0);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showEditPlanning, setShowEditPlanning] = useState(false);
  const [isRestDay, setIsRestDay] = useState(false);
  
  // Hook for required monthly goal check
  const { isRequired: isMonthlyGoalRequired, reason: monthlyGoalReason, onCompleted: onMonthlyGoalCompleted, isLoading: isCheckingGoal } = useMonthlyGoalRequired(user?.id);
  
  // Check if today is a rest day
  useEffect(() => {
    if (!user) return;
    
    const checkRestDay = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("working_days")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.working_days) {
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()]!;
        const isRest = !profile.working_days.includes(dayOfWeek);
        setIsRestDay(isRest);
      }
    };

    checkRestDay();
  }, [user]);
  
  // Load cached data on mount
  useEffect(() => {
    const cachedData = localStorage.getItem("orbis_dashboard_cache");
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        setMonthlyStats(parsed.monthlyStats || monthlyStats);
        setDailyAverage(parsed.dailyAverage || 0);
        setActiveDaysCount(parsed.activeDaysCount || 0);
      } catch (e) {
        console.error("Error parsing cache:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }
    
    if (user) {
      loadDashboardData();
    }
  }, [user, loading, navigate]);

  // Recarrega ao voltar o foco (ex.: retorno do DEFCON 4) para nunca mostrar dado antigo
  useRefetchOnFocus(() => {
    if (user) loadDashboardData();
  });

  // Mostra a escolha (assinar agora / testar 3 dias) logo no 1º acesso, por usuário.
  useEffect(() => {
    if (!user) return;

    const checkCardModal = async () => {
      const seenKey = `orbis_card_modal_seen_${user.id}`;
      if (localStorage.getItem(seenKey)) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_status, is_demo, billing_exempt")
        .eq("user_id", user.id)
        .maybeSingle();

      // Só mostra se ainda não é assinante
      const isSubscribed = (profile?.is_demo && profile?.billing_exempt) || profile?.plan_status === "active";
      if (!isSubscribed) {
        setShowCardModal(true);
        localStorage.setItem(seenKey, 'true');
      }
    };

    checkCardModal();
  }, [user]);
  const loadDashboardData = async (customStartDate?: string, customEndDate?: string) => {
    if (!user) return;

    setIsLoadingData(true);

    const today = getBrazilDate();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let dateStart: string;
    let dateEnd: string;
    if (customStartDate && customEndDate) {
      dateStart = customStartDate;
      dateEnd = customEndDate;
    } else {
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      dateStart = firstDayOfMonth.toISOString().split('T')[0]!;
      dateEnd = new Date().toISOString().split('T')[0]!;
    }

    // Fan-out: profile + today + week + month in parallel (was 4 serial awaits).
    const [
      { data: profile },
      { data: todayData },
      { data: weekData },
      { data: monthData },
      { data: todayChallenge },
      { data: monthExpenses },
      { data: todayGoalPlan },
    ] = await Promise.all([
      supabase.from("profiles").select("monthly_goal, nickname").eq("user_id", user.id).maybeSingle(),
      supabase.from("daily_sales").select("*").eq("user_id", user.id).eq("date", today),
      supabase.from("daily_sales").select("*").eq("user_id", user.id).gte("date", sevenDaysAgo.toISOString().split('T')[0]!).order("date", { ascending: true }),
      supabase.from("daily_sales").select("*").eq("user_id", user.id).gte("date", dateStart).lte("date", dateEnd).order("date", { ascending: false }).limit(30),
      supabase.from("challenge_blocks").select("sales_count,created_at").eq("user_id", user.id).gte("created_at", today),
      supabase.from("personal_expenses").select("amount,date").eq("user_id", user.id).gte("date", dateStart).lte("date", dateEnd),
      supabase.from("daily_goal_plans").select("daily_goal").eq("user_id", user.id).eq("date", today).maybeSingle(),
    ]);

    if (profile?.monthly_goal) {
      setMonthlyGoal(profile.monthly_goal);
    }
    if (profile?.nickname) {
      setNickname(profile.nickname);
    }

    const aggregatedToday = todayData && todayData.length > 0 ? {
      total_profit: todayData.reduce((sum, entry) => sum + (entry.total_profit || 0), 0),
      total_debt: todayData.reduce((sum, entry) => sum + (entry.total_debt || 0), 0),
      cash_sales: todayData.reduce((sum, entry) => sum + (entry.cash_sales || 0), 0),
      pix_sales: todayData.reduce((sum, entry) => sum + (entry.pix_sales || 0), 0),
      card_sales: todayData.reduce((sum, entry) => sum + (entry.card_sales || 0), 0),
      entry_count: todayData.length
    } : null;
    setTodaySales(aggregatedToday);
    setSalesCountToday(((todayChallenge as any[]) || []).reduce((s, b) => s + (b.sales_count || 0), 0));
    setMonthExpensesTotal(((monthExpenses as any[]) || []).reduce((s, e) => s + Number(e.amount || 0), 0));
    setDailyGoalPlan(Number((todayGoalPlan as any)?.daily_goal) || 0);

    if (weekData) {
      const formattedWeekData = weekData.map(day => ({
        name: new Date(day.date).toLocaleDateString("pt-BR", {
          weekday: "short"
        }),
        value: day.total_profit || 0
      }));
      setWeeklyData(formattedWeekData);
    }

    if (monthData) {
      const totalIncome = monthData.reduce((sum, day) => sum + (day.total_profit || 0), 0);
      const totalExpenses = monthData.reduce((sum, day) => sum + (day.total_debt || 0), 0); // fiado: mostrado à parte, NÃO entra no líquido
      const totalCost = monthData.reduce((sum, day) => sum + (day.cost || 0), 0);
      const totalTransport = monthData.reduce((sum, day) => sum + (Number((day as any).transport_cost) || 0), 0);
      const totalFood = monthData.reduce((sum, day) => sum + (Number((day as any).food_cost) || 0), 0);
      // Custos lançados no botão "Custos do dia" (personal_expenses) também abatem do líquido.
      const custosLancados = ((monthExpenses as any[]) || []).reduce((s, e) => s + Number(e.amount || 0), 0);
      // Líquido = vendido − mercadoria − transporte − alimentação − custos lançados (fiado NÃO entra)
      const balance = totalIncome - totalCost - totalTransport - totalFood - custosLancados;
      
      // Calculate real daily average from NET PROFIT (lucro líquido)
      const activeDays = monthData.filter(day => (day.total_profit ?? 0) > 0).length;
      const netProfitPerDay = activeDays > 0 ? balance / activeDays : 0;
      
      setActiveDaysCount(activeDays);
      setDailyAverage(netProfitPerDay);
      
      const stats = {
        totalIncome,
        totalExpenses,
        totalCost,
        totalTransport,
        totalFood,
        balance,
        variation: totalIncome > 0 ? balance / totalIncome * 100 : 0
      };
      
      setMonthlyStats(stats);
      
      // Cache data
      localStorage.setItem("orbis_dashboard_cache", JSON.stringify({
        monthlyStats: stats,
        dailyAverage: netProfitPerDay,
        activeDaysCount: activeDays,
        lastUpdate: new Date().toISOString()
      }));
    }
    
    setIsLoadingData(false);
  };

  const handleApplyFilter = () => {
    if (!startDate || !endDate) {
      toast({
        title: "Erro",
        description: "Selecione as datas de início e fim.",
        variant: "destructive"
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast({
        title: "Erro",
        description: "A data de início deve ser anterior à data de fim.",
        variant: "destructive"
      });
      return;
    }

    setIsFiltering(true);
    loadDashboardData(startDate, endDate);
    toast({
      title: "Filtro aplicado",
      description: `Mostrando dados de ${new Date(startDate).toLocaleDateString('pt-BR')} até ${new Date(endDate).toLocaleDateString('pt-BR')}`
    });
  };

  const handleQuickFilter = (type: "day" | "week" | "month" | "all") => {
    const today = new Date();
    const end: string = today.toISOString().split('T')[0]!;
    let start: string;

    switch (type) {
      case "day":
        start = end;
        break;
      case "week": {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        start = weekAgo.toISOString().split('T')[0]!;
        break;
      }
      case "month": {
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        start = firstDayOfMonth.toISOString().split('T')[0]!;
        break;
      }
      case "all":
        start = "2020-01-01";
        break;
    }

    setFilterType(type);
    setStartDate(start);
    setEndDate(end);
    setIsFiltering(type !== "month");
    loadDashboardData(start, end);

    const labels = {
      day: "Hoje",
      week: "Últimos 7 dias",
      month: "Mês atual",
      all: "Todo período"
    };

    toast({
      title: "Filtro aplicado",
      description: labels[type]
    });
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
    setIsFiltering(false);
    setFilterType("month");
    loadDashboardData();
    toast({
      title: "Filtro removido",
      description: "Mostrando dados do mês atual"
    });
  };
  const calculateGoalProgress = () => {
    const progress = monthlyStats.balance / monthlyGoal * 100;
    return Math.min(progress, 100);
  };

  if (loading || !user) {
    // Esqueleto com o formato do dashboard — evita a tela "pular" do vazio pro design
    return (
      <div className="space-y-4 pb-8 animate-pulse">
        <div className="flex items-center gap-3 pt-2">
          <div className="w-10 h-10 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
        </div>
        <div className="h-56 rounded-2xl bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl bg-muted" />
          <div className="h-24 rounded-2xl bg-muted" />
        </div>
        <div className="h-20 rounded-2xl bg-muted" />
        <div className="h-20 rounded-2xl bg-muted" />
      </div>
    );
  }
  const dailyProfit = todaySales?.total_profit || 0;
  const faturamentoMes = monthlyStats.totalIncome;
  const lucroLiquido = monthlyStats.totalIncome - monthlyStats.totalCost - monthlyStats.totalTransport - monthlyStats.totalFood - monthExpensesTotal;
  const progressoMeta = calculateGoalProgress();

  // Daily goal calc
  // Meta do dia = a MESMA que o usuário define no DEFCON (daily_goal_plans). Só
  // cai pra meta mensal ÷ 26 quando ainda não há meta do dia definida.
  const dailyGoal = dailyGoalPlan > 0 ? dailyGoalPlan : (monthlyGoal > 0 ? Math.round(monthlyGoal / 26) : 200);
  const faltaDia = Math.max(dailyGoal - dailyProfit, 0);
  const totalSalesToday = salesCountToday;
  const custosTotal = monthlyStats.totalCost + monthlyStats.totalTransport + monthlyStats.totalFood + monthExpensesTotal;

  const nextIdx = REWARD_TIERS.findIndex((t) => faturamentoMes < t.threshold);
  const nextTier = (nextIdx === -1 ? REWARD_TIERS[REWARD_TIERS.length - 1] : REWARD_TIERS[nextIdx])!;
  const prevThreshold = nextIdx <= 0 ? 0 : REWARD_TIERS[nextIdx - 1]!.threshold;
  const tierProgress = nextIdx === -1
    ? 100
    : Math.min(((faturamentoMes - prevThreshold) / (nextTier.threshold - prevThreshold)) * 100, 100);
  const tierRestante = Math.max(nextTier.threshold - faturamentoMes, 0);

  // Saudação dinâmica baseada no fuso horário (Brasília UTC-3)
  const getGreeting = () => {
    const hourBrasilia = Number(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false })
    );
    if (hourBrasilia >= 5 && hourBrasilia < 12) return "Bom dia";
    if (hourBrasilia >= 12 && hourBrasilia < 18) return "Boa tarde";
    return "Boa noite";
  };
  const greeting = getGreeting();

  return <div className="bg-background px-5 pt-4 pb-8 space-y-3 animate-fade-in overflow-x-hidden max-w-2xl mx-auto">
      {user && <X1InvitePopup userId={user.id} />}
      {/* Greeting */}
      <div className="flex items-center gap-3 py-2">
        <img
          src="/orbis-logo.png"
          alt="Orbis"
          className="w-11 h-11 object-contain shrink-0 animate-orbis-spin-in"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold tracking-tight text-foreground truncate">
            {greeting}, <span className="text-primary">{nickname || "vendedor"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {progressoMeta >= 100
              ? "Meta do mês batida"
              : faltaDia > 0
              ? `Faltam ${formatCurrency(faltaDia)} para a meta diária`
              : "Meta diária atingida hoje"}
          </p>
        </div>
      </div>

      {isRestDay && (
        <div className="px-4 py-3 bg-card rounded-2xl text-center border border-border">
          <p className="text-sm text-muted-foreground">Hoje é seu dia de descanso</p>
        </div>
      )}

      {/* HERO: Faturamento do mês (single hero) */}
      <Card className="bg-card border border-border rounded-2xl shadow-lg">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground mb-2">Faturamento do mês</p>
              <p className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                {formatCurrency(faturamentoMes)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Meta {formatCurrency(monthlyGoal)} · <span className="text-primary font-semibold">{progressoMeta.toFixed(0)}%</span>
              </p>
            </div>
            <button
              data-tour="meta-input"
              onClick={() => setShowEditPlanning(true)}
              className="h-11 w-11 inline-flex items-center justify-center hover:bg-muted rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
              aria-label="Editar planejamento"
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${progressoMeta}%` }}
            />
          </div>

          {/* Today inline (demoted) */}
          <div className="flex items-end justify-between pt-3 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="text-2xl font-bold text-foreground tracking-tight">
                {formatCurrency(dailyProfit)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{totalSalesToday} {totalSalesToday === 1 ? "venda" : "vendas"}</p>
              <p className="text-xs text-muted-foreground">
                {faltaDia > 0 ? `Faltam ${formatCurrency(faltaDia)}` : "Meta diária atingida"}
              </p>
            </div>
          </div>

          <Button
            onClick={() => navigate('/daily-goals')}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl"
          >
            Ir para Ritmo
          </Button>
        </CardContent>
      </Card>

      {/* Lucro líquido + Custos (split) */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card border border-border rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Lucro líquido</p>
            <p className="text-2xl font-bold mt-1 text-success tracking-tight truncate">
              {formatCurrency(lucroLiquido)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Custos</p>
            <p className="text-2xl font-bold mt-1 text-destructive tracking-tight truncate">
              {formatCurrency(custosTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Próxima patente — compact, no shine, no float */}
      <button
        onClick={() => navigate('/rewards')}
        className="w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Ver recompensas por conquista"
      >
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `hsl(${nextTier.accent} / 0.15)`,
              border: `1px solid hsl(${nextTier.accent} / 0.35)`,
            }}
          >
            <span className="text-2xl leading-none">{nextTier.emoji}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-foreground truncate">
                Próxima: Patente {nextTier.name}
              </p>
              <p className="text-xs text-muted-foreground shrink-0">
                {tierProgress.toFixed(0)}%
              </p>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-out"
                style={{
                  width: `${tierProgress}%`,
                  background: `hsl(${nextTier.accent})`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Faltam {formatCurrency(tierRestante)}
            </p>
          </div>
        </div>
      </button>

      {user && faltaDia <= 0 && dailyProfit > 0 && (
        <TrialNudge
          userId={user.id}
          momentKey="meta_dia"
          title="Meta do dia batida! 🎯"
          benefit="Quem usa o Orbis todo dia bate meta com ritmo. Não perca essa régua quando o teste acabar."
        />
      )}

      {user && <RankingCard userId={user.id} onClick={() => navigate('/ranking')} />}

      {user && <CompetitionCard userId={user.id} onClick={() => navigate('/competitions')} />}

      <AntiProcrastination visible={!isRestDay && !hasPlanToday} />

      <CardRegistrationModal isOpen={showCardModal} onClose={() => setShowCardModal(false)} />

      {user && (() => {
        // O modal abre SEMPRE que o usuário pede (showEditPlanning) — inclusive no
        // passo de metas do onboarding. O "obrigatório" (forçado, sem fechar) só
        // vale DEPOIS que a missão terminou; durante o onboarding ele nunca força,
        // senão o usuário não consegue definir a meta e fica preso (tinha que pular).
        const missionDone = localStorage.getItem(`orbis_mission_completed_${user.id}`) === 'true';
        const forced = isMonthlyGoalRequired && missionDone;
        const open = showEditPlanning || forced;
        if (!open) return null;
        return (
          <EditPlanningModal
            userId={user.id}
            isOpen={open}
            onClose={() => {
              if (forced) onMonthlyGoalCompleted();
              setShowEditPlanning(false);
              loadDashboardData();
            }}
            isRequired={forced}
            requiredReason={monthlyGoalReason}
          />
        );
      })()}

      {user && !isRestDay && !isMonthlyGoalRequired && localStorage.getItem(`orbis_mission_completed_${user.id}`) === 'true' && (
        <DayStartPopup
          userId={user.id}
          onStart={() => navigate('/daily-goals')}
          onEditPlanning={() => setShowEditPlanning(true)}
        />
      )}
    </div>;
}