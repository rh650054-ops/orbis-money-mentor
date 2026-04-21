import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, TrendingDown, Target, Flame, Zap, Pencil, ShoppingCart, Calendar, Filter, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useDailyGoalPlan } from "@/hooks/useDailyGoalPlan";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { StreakDisplay } from "@/components/StreakDisplay";
import StreakCard from "@/components/StreakCard";
import AntiProcrastination from "@/components/AntiProcrastination";
import { WeeklyPlanning } from "@/components/WeeklyPlanning";
import { formatCurrency } from "@/lib/utils";
import { getBrazilDate } from "@/lib/dateUtils";
import CardRegistrationModal from "@/components/CardRegistrationModal";
import { EditPlanningModal } from "@/components/EditPlanningModal";
import { DayStartPopup } from "@/components/DayStartPopup";
import { useMonthlyGoalRequired } from "@/hooks/useMonthlyGoalRequired";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { hasPlanToday, loading: planLoading } = useDailyGoalPlan(user?.id);
  const { toast } = useToast();
  const [todaySales, setTodaySales] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    totalCost: 0,
    balance: 0,
    variation: 0
  });
  const [monthlyGoal, setMonthlyGoal] = useState(4200);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterType, setFilterType] = useState<"day" | "week" | "month" | "all" | "custom">("month");
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
        .single();

      if (profile?.working_days) {
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
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

  // Check if should show card registration modal (only on first access for non-subscribers)
  useEffect(() => {
    if (!user) return;
    if (!localStorage.getItem('orbis_onboarding_completo')) return;
    
    const checkCardModal = async () => {
      const hasSeenCardModal = localStorage.getItem('hasSeenCardModal');
      if (hasSeenCardModal) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_status, is_demo, billing_exempt")
        .eq("user_id", user.id)
        .single();

      // Only show if not subscribed
      const isSubscribed = (profile?.is_demo && profile?.billing_exempt) || profile?.plan_status === "active";
      if (!isSubscribed) {
        setShowCardModal(true);
        localStorage.setItem('hasSeenCardModal', 'true');
      }
    };

    checkCardModal();
  }, [user]);
  const loadDashboardData = async (customStartDate?: string, customEndDate?: string) => {
    if (!user) return;

    setIsLoadingData(true);

    // Carregar meta do perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("monthly_goal")
      .eq("user_id", user.id)
      .single();
    
    if (profile?.monthly_goal) {
      setMonthlyGoal(profile.monthly_goal);
    }

    // Carregar todas as vendas de hoje e agregar
    const today = getBrazilDate();
    const {
      data: todayData
    } = await supabase.from("daily_sales").select("*").eq("user_id", user.id).eq("date", today);

    // Agregar múltiplos lançamentos do dia
    const aggregatedToday = todayData && todayData.length > 0 ? {
      total_profit: todayData.reduce((sum, entry) => sum + (entry.total_profit || 0), 0),
      total_debt: todayData.reduce((sum, entry) => sum + (entry.total_debt || 0), 0),
      cash_sales: todayData.reduce((sum, entry) => sum + (entry.cash_sales || 0), 0),
      pix_sales: todayData.reduce((sum, entry) => sum + (entry.pix_sales || 0), 0),
      card_sales: todayData.reduce((sum, entry) => sum + (entry.card_sales || 0), 0),
      entry_count: todayData.length
    } : null;
    setTodaySales(aggregatedToday);

    // Carregar dados da última semana
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const {
      data: weekData
    } = await supabase.from("daily_sales").select("*").eq("user_id", user.id).gte("date", sevenDaysAgo.toISOString().split('T')[0]).order("date", {
      ascending: true
    });
    if (weekData) {
      const formattedWeekData = weekData.map(day => ({
        name: new Date(day.date).toLocaleDateString("pt-BR", {
          weekday: "short"
        }),
        value: day.total_profit || 0
      }));
      setWeeklyData(formattedWeekData);
    }

    // Calcular estatísticas baseado no período
    let dateStart: string;
    let dateEnd: string;

    if (customStartDate && customEndDate) {
      // Período personalizado
      dateStart = customStartDate;
      dateEnd = customEndDate;
    } else {
      // Período padrão (mês atual)
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      dateStart = firstDayOfMonth.toISOString().split('T')[0];
      dateEnd = new Date().toISOString().split('T')[0];
    }

    const {
      data: monthData
    } = await supabase.from("daily_sales").select("*").eq("user_id", user.id).gte("date", dateStart).lte("date", dateEnd).order("date", { ascending: false }).limit(30);
    
    if (monthData) {
      const totalIncome = monthData.reduce((sum, day) => sum + (day.total_profit || 0), 0);
      const totalExpenses = monthData.reduce((sum, day) => sum + (day.total_debt || 0), 0);
      const totalCost = monthData.reduce((sum, day) => sum + (day.cost || 0), 0);
      const balance = totalIncome - totalExpenses - totalCost;
      
      // Calculate real daily average from NET PROFIT (lucro líquido)
      const activeDays = monthData.filter(day => day.total_profit > 0).length;
      const netProfitPerDay = activeDays > 0 ? balance / activeDays : 0;
      
      setActiveDaysCount(activeDays);
      setDailyAverage(netProfitPerDay);
      
      const stats = {
        totalIncome,
        totalExpenses,
        totalCost,
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
    let start: string;
    let end: string = today.toISOString().split('T')[0];

    switch (type) {
      case "day":
        start = end;
        break;
      case "week":
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        start = weekAgo.toISOString().split('T')[0];
        break;
      case "month":
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        start = firstDayOfMonth.toISOString().split('T')[0];
        break;
      case "all":
        start = "2020-01-01"; // Data antiga para pegar todos os registros
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

  const getMotivationMessage = () => {
    if (!todaySales) {
      return {
        icon: "💪",
        title: "Comece seu dia!",
        message: "Registre suas primeiras vendas"
      };
    }
    const profit = todaySales.total_profit || 0;
    const goal = 200; // Meta diária padrão
    const percentage = profit / goal * 100;
    if (percentage >= 100) {
      return {
        icon: "🔥",
        title: "Meta atingida!",
        message: `Você bateu ${percentage.toFixed(0)}% da meta hoje`
      };
    } else if (percentage >= 50) {
      return {
        icon: "💪",
        title: "Continue evoluindo!",
        message: `Você está perto! ${percentage.toFixed(0)}% da meta`
      };
    } else {
      return {
        icon: "⚡",
        title: "Vamos lá!",
        message: "Cada venda conta para seu sucesso"
      };
    }
  };
  if (loading || !user) {
    return null;
  }
  const motivation = getMotivationMessage();
  const dailyProfit = todaySales?.total_profit || 0;
  const faturamentoMes = monthlyStats.totalIncome;
  const lucroLiquido = monthlyStats.totalIncome - monthlyStats.totalExpenses - monthlyStats.totalCost;
  const faltaParaMeta = Math.max(monthlyGoal - faturamentoMes, 0);
  const progressoMeta = calculateGoalProgress();

  // Daily goal calc
  const dailyGoal = monthlyGoal > 0 ? Math.round(monthlyGoal / 26) : 200;
  const dailyProgress = dailyGoal > 0 ? Math.min((dailyProfit / dailyGoal) * 100, 100) : 0;
  const faltaDia = Math.max(dailyGoal - dailyProfit, 0);
  const totalSalesToday = todaySales?.entry_count || 0;
  const custosTotal = monthlyStats.totalExpenses + monthlyStats.totalCost;

  return <div className="min-h-screen bg-background px-5 pt-6 pb-24 space-y-6 animate-fade-in overflow-x-hidden max-w-2xl mx-auto">
      {/* 1. HEADER MINIMALISTA */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">O</span>
          </div>
          <span className="font-semibold tracking-tight text-foreground">Orbis</span>
        </div>
        <button
          onClick={() => navigate('/profile')}
          className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Perfil"
        >
          <span className="text-xs">👤</span>
        </button>
      </header>

      {/* Mensagem de descanso (discreta) */}
      {isRestDay && (
        <div className="px-4 py-3 bg-card rounded-2xl text-center border border-border">
          <p className="text-sm text-muted-foreground">🌴 Hoje é seu dia de descanso</p>
        </div>
      )}

      {/* 2. CARD PRINCIPAL — HOJE (FOCO TOTAL) */}
      <Card className="bg-card border border-border rounded-2xl shadow-lg">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Hoje</p>
              <p className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                {formatCurrency(dailyProfit)}
              </p>
            </div>
            <div className="text-right pb-1">
              <p className="text-2xl font-semibold text-foreground">{totalSalesToday}</p>
              <p className="text-xs text-muted-foreground">vendas</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-smooth"
                style={{ width: `${dailyProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Meta diária: {formatCurrency(dailyGoal)}</span>
              <span>{faltaDia > 0 ? `Faltam ${formatCurrency(faltaDia)}` : "Meta atingida 🎯"}</span>
            </div>
          </div>

          <Button
            onClick={() => navigate('/daily-goals')}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl shadow-[var(--glow-primary)]"
          >
            Ir para Ritmo
          </Button>
        </CardContent>
      </Card>

      {/* 3. RESUMO DO MÊS */}
      <Card className="bg-card border border-border rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Faturamento do mês</p>
              <p className="text-xl font-semibold mt-1 text-foreground">
                {formatCurrency(faturamentoMes)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary font-medium">{progressoMeta.toFixed(0)}%</span>
              <button
                onClick={() => setShowEditPlanning(true)}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                aria-label="Editar planejamento"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-smooth"
              style={{ width: `${progressoMeta}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 4. VISÃO FINANCEIRA — 2 cards lado a lado */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-card border border-border rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Lucro líquido</p>
            <p className="text-xl md:text-2xl font-bold mt-2 text-success">
              {formatCurrency(lucroLiquido)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Custos</p>
            <p className="text-xl md:text-2xl font-bold mt-2 text-destructive">
              {formatCurrency(custosTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 5. PRÓXIMA CONQUISTA */}
      <Card className="bg-card border border-border rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Próxima conquista</p>
            <span className="text-xs text-muted-foreground">{progressoMeta.toFixed(0)}%</span>
          </div>
          <p className="text-lg font-semibold text-foreground">
            {formatCurrency(faturamentoMes)}{" "}
            <span className="text-muted-foreground text-sm font-normal">
              / {formatCurrency(monthlyGoal)}
            </span>
          </p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-smooth"
              style={{ width: `${progressoMeta}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 6. GRÁFICO SEMANAL */}
      {weeklyData.length > 0 && (
        <Card className="bg-card border border-border rounded-2xl">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-medium text-muted-foreground">Últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent className="h-[180px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={value => [formatCurrency(Number(value)), 'Vendido']}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Anti-procrastination — mantido (não é gamificação visual extra) */}
      <AntiProcrastination visible={!isRestDay && !hasPlanToday} />

      <CardRegistrationModal isOpen={showCardModal} onClose={() => setShowCardModal(false)} />

      {user && (isMonthlyGoalRequired || showEditPlanning) && (
        <EditPlanningModal
          userId={user.id}
          isOpen={isMonthlyGoalRequired || showEditPlanning}
          onClose={() => {
            if (isMonthlyGoalRequired) {
              onMonthlyGoalCompleted();
            }
            setShowEditPlanning(false);
            loadDashboardData();
          }}
          isRequired={isMonthlyGoalRequired}
          requiredReason={monthlyGoalReason}
        />
      )}

      {user && !isRestDay && !isMonthlyGoalRequired && (
        <DayStartPopup
          userId={user.id}
          onStart={() => navigate('/daily-goals')}
          onEditPlanning={() => setShowEditPlanning(true)}
        />
      )}
    </div>;
}