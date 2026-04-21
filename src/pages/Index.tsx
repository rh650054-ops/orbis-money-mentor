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

  return <div className="min-h-screen p-4 md:p-8 space-y-8 animate-fade-in overflow-x-hidden max-w-3xl mx-auto">
      {/* Header — clean, left-aligned */}
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">Dashboard</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Domine seus números.
        </h1>
      </header>

      {/* Streak (mantido, leve) */}
      <StreakDisplay userId={user.id} />

      {/* Mensagem de Descanso */}
      {isRestDay && (
        <div className="p-4 bg-card rounded-2xl text-center border border-border">
          <p className="text-sm text-muted-foreground">🌴 Hoje é seu dia de descanso.</p>
        </div>
      )}

      {/* 1. FATURAMENTO DO MÊS — bloco principal (foco máximo) */}
      <Card className="bg-card border border-border rounded-2xl shadow-sm">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Faturamento do mês</p>
              <p className="text-4xl md:text-5xl font-bold mt-2 tracking-tight">
                {formatCurrency(faturamentoMes)}
              </p>
            </div>
            <button
              onClick={() => setShowEditPlanning(true)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Editar planejamento"
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Barra de progresso dourada */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Meta: {formatCurrency(monthlyGoal)}</span>
              <span className="text-primary font-semibold">{progressoMeta.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-smooth"
                style={{ width: `${progressoMeta}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {faltaParaMeta > 0
                ? `Falta ${formatCurrency(faltaParaMeta)} para a meta`
                : "Meta do mês atingida 🎯"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 2. LUCRO LÍQUIDO + MÉDIA DIÁRIA */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border border-border rounded-2xl">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Lucro líquido</p>
            <p className="text-2xl md:text-3xl font-bold mt-2 text-success">
              {formatCurrency(lucroLiquido)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">No mês atual</p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border rounded-2xl">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Lucro médio diário</p>
            {isLoadingData ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <>
                <p className="text-2xl md:text-3xl font-bold mt-2 text-success">
                  {formatCurrency(dailyAverage)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {activeDaysCount} dias ativos
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. HOJE — com botão de ação dourado */}
      <Card className="bg-card border border-border rounded-2xl">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Hoje</p>
              <p className="text-2xl md:text-3xl font-bold mt-1">
                {formatCurrency(dailyProfit)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Lançamentos</p>
              <p className="text-lg font-semibold">{todaySales?.entry_count || 0}</p>
            </div>
          </div>

          {todaySales && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-background/50 border border-border">
                <p className="text-xs text-muted-foreground">Lucro</p>
                <p className="text-sm font-bold text-success mt-0.5">
                  {formatCurrency(dailyProfit)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-border">
                <p className="text-xs text-muted-foreground">Calotes</p>
                <p className="text-sm font-bold text-destructive mt-0.5">
                  {formatCurrency(todaySales.total_debt || 0)}
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={() => navigate('/daily-goals')}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl"
          >
            Ir para Ritmo
          </Button>
        </CardContent>
      </Card>

      {/* 4. PRÓXIMA META — discreto */}
      <Card className="bg-card border border-border rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Próxima meta</p>
                <p className="text-sm font-semibold">
                  {faltaParaMeta > 0 ? formatCurrency(faltaParaMeta) : "Concluída"}
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {progressoMeta.toFixed(0)}% concluído
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Routine + Anti-procrastination (agrupados ao final) */}
      <StreakCard userId={user.id} />
      <AntiProcrastination visible={!isRestDay && !hasPlanToday} />

      {/* Filtros — colapsado por padrão */}
      <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <Card className="bg-card border border-border rounded-2xl">
          <CardContent className="p-4">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Filtrar período</span>
                  {isFiltering && (
                    <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                      Ativo
                    </span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 mt-4">
              <div className="flex flex-wrap gap-2">
                {(["day","week","month","all"] as const).map(t => (
                  <Button
                    key={t}
                    size="sm"
                    variant={filterType === t ? "default" : "outline"}
                    onClick={() => handleQuickFilter(t)}
                    className="flex-1 md:flex-none"
                  >
                    {t === "day" ? "Hoje" : t === "week" ? "Semana" : t === "month" ? "Mês" : "Tudo"}
                  </Button>
                ))}
              </div>

              <div className="space-y-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Período Personalizado</p>
                <div className="flex flex-col md:flex-row gap-2">
                  <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setFilterType("custom"); }} className="flex-1" />
                  <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setFilterType("custom"); }} max={new Date().toISOString().split('T')[0]} className="flex-1" />
                  <Button onClick={handleApplyFilter} size="sm">Aplicar</Button>
                  {isFiltering && (
                    <Button onClick={handleClearFilter} size="sm" variant="outline">Limpar</Button>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>

      {/* Evolução semanal */}
      {weeklyData.length > 0 && (
        <Card className="bg-card border border-border rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Evolução semanal</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} formatter={value => [`R$ ${value}`, 'Vendido']} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <CardRegistrationModal isOpen={showCardModal} onClose={() => setShowCardModal(false)} />
      
      <CardRegistrationModal 
        isOpen={showCardModal} 
        onClose={() => setShowCardModal(false)} 
      />
      
      {/* Required Monthly Goal Modal */}
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