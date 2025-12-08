import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, TrendingDown, Target, Flame, Zap, Pencil, Check, X, ShoppingCart, Calendar, Filter, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useDailyGoalPlan } from "@/hooks/useDailyGoalPlan";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { StreakDisplay } from "@/components/StreakDisplay";
import { WeeklyPlanning } from "@/components/WeeklyPlanning";
import { formatCurrency } from "@/lib/utils";
import { getBrazilDate } from "@/lib/dateUtils";
import CardRegistrationModal from "@/components/CardRegistrationModal";
import WeeklyPlanningModal from "@/components/WeeklyPlanningModal";
import { DayStartPopup } from "@/components/DayStartPopup";
import { DashboardBlockStats } from "@/components/DashboardBlockStats";
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
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("4200");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterType, setFilterType] = useState<"day" | "week" | "month" | "all" | "custom">("month");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dailyAverage, setDailyAverage] = useState(0);
  const [activeDaysCount, setActiveDaysCount] = useState(0);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showWeeklyPlanning, setShowWeeklyPlanning] = useState(false);
  const [isRestDay, setIsRestDay] = useState(false);
  
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
  
  // Check if should show weekly planning modal
  useEffect(() => {
    if (!user) return;
    
    const checkWeeklyPlanning = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("week_start_date")
        .eq("user_id", user.id)
        .single();

      if (!profile?.week_start_date) {
        // Primeira vez, mostrar modal
        setShowWeeklyPlanning(true);
        return;
      }

      const lastPlanningDate = new Date(profile.week_start_date);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - lastPlanningDate.getTime()) / (1000 * 60 * 60 * 24));

      // Mostrar modal se passou 7 dias
      if (daysDiff >= 7) {
        setShowWeeklyPlanning(true);
      }
    };

    checkWeeklyPlanning();
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
    
    const checkCardModal = async () => {
      const hasSeenCardModal = localStorage.getItem('hasSeenCardModal');
      if (hasSeenCardModal) return;

      // Check subscription status
      const session = await supabase.auth.getSession();
      if (!session.data.session) return;

      const { data } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
        },
      });

      // Only show if not subscribed
      if (!data?.subscribed) {
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
      setGoalInput(profile.monthly_goal.toString());
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

  const handleSaveGoal = async () => {
    const newGoal = parseFloat(goalInput);
    if (isNaN(newGoal) || newGoal <= 0) {
      toast({
        title: "Erro",
        description: "Digite um valor válido para a meta.",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ monthly_goal: newGoal })
      .eq("user_id", user?.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a meta.",
        variant: "destructive"
      });
      return;
    }

    setMonthlyGoal(newGoal);
    setIsEditingGoal(false);
    toast({
      title: "✅ Meta atualizada!",
      description: `Nova meta: ${formatCurrency(newGoal)}`
    });
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
  return <div className="min-h-screen p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Hero Section */}
      <div className="text-center space-y-1 mb-6">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          <span className="block bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Domine seus números.
          </span>
        </h1>
        <h2 className="text-4xl md:text-6xl font-bold tracking-tight">
          <span className="block bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Domine seu futuro.
          </span>
        </h2>
        <p className="text-muted-foreground text-sm md:text-base mt-4">
          Controle total das suas finanças com insights inteligentes e metas personalizadas
        </p>
      </div>

      {/* Mensagem de Descanso */}
      {isRestDay && (
        <div className="p-4 bg-primary/10 rounded-lg text-center border border-primary/20">
          <p className="text-sm text-muted-foreground">🌴 Hoje é seu dia de descanso.</p>
        </div>
      )}

      {/* Planejamento Semanal */}
      <WeeklyPlanning userId={user.id} />

      {/* Resumo do Ritmo - Estatísticas dos Blocos de Hora */}
      <DashboardBlockStats userId={user.id} />

      {/* Streak e Vision Points */}
      <StreakDisplay userId={user.id} />

      {/* Filtros de Período - Colapsável */}
      <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <Card className="card-gradient-border">
          <CardContent className="p-4">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Filtros de Período</h3>
                  {isFiltering && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                      Ativo
                    </span>
                  )}
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isFilterOpen ? "rotate-180" : ""}`} />
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="space-y-4 mt-4">
              {/* Botões de Filtro Rápido */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={filterType === "day" ? "default" : "outline"}
                  onClick={() => handleQuickFilter("day")}
                  className="flex-1 md:flex-none"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Hoje
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "week" ? "default" : "outline"}
                  onClick={() => handleQuickFilter("week")}
                  className="flex-1 md:flex-none"
                >
                  Semana
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "month" ? "default" : "outline"}
                  onClick={() => handleQuickFilter("month")}
                  className="flex-1 md:flex-none"
                >
                  Mês
                </Button>
                <Button
                  size="sm"
                  variant={filterType === "all" ? "default" : "outline"}
                  onClick={() => handleQuickFilter("all")}
                  className="flex-1 md:flex-none"
                >
                  Todo Período
                </Button>
              </div>

              {/* Filtro Personalizado */}
              <div className="space-y-3 pt-3 border-t">
                <p className="text-sm text-muted-foreground">Período Personalizado</p>
                <div className="flex flex-col md:flex-row gap-3">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setFilterType("custom");
                    }}
                    placeholder="Data início"
                    className="flex-1"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setFilterType("custom");
                    }}
                    max={new Date().toISOString().split('T')[0]}
                    placeholder="Data fim"
                    className="flex-1"
                  />
                  <Button onClick={handleApplyFilter} size="sm" className="gap-2 md:w-auto w-full">
                    Aplicar
                  </Button>
                  {isFiltering && (
                    <Button onClick={handleClearFilter} size="sm" variant="outline" className="md:w-auto w-full">
                      Limpar
                    </Button>
                  )}
                </div>
              </div>

              {filterType === "custom" && isFiltering && (
                <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg text-center">
                  <p className="text-xs text-primary font-medium">
                    📊 Período personalizado: {new Date(startDate).toLocaleDateString('pt-BR')} até {new Date(endDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>

    {/* Financial Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="card-gradient-border card-fixed-height hover:shadow-glow-success transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lucro
            </CardTitle>
            <Zap className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-success whitespace-nowrap">
              {formatCurrency(monthlyStats.totalIncome - monthlyStats.totalExpenses - monthlyStats.totalCost)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lucro líquido
            </p>
          </CardContent>
        </Card>

        <Card className="card-gradient-border card-fixed-height hover:shadow-glow-success transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entradas
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-success whitespace-nowrap">
              {formatCurrency(monthlyStats.totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total no mês
            </p>
          </CardContent>
        </Card>

        <Card className="card-gradient-border card-fixed-height hover:shadow-glow-primary transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saídas
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-destructive whitespace-nowrap">
              {formatCurrency(monthlyStats.totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Calotes no mês
            </p>
          </CardContent>
        </Card>

        <Card className="card-gradient-border card-fixed-height hover:shadow-glow-primary transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gasto Mercadoria
            </CardTitle>
            <ShoppingCart className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-warning whitespace-nowrap">
              {formatCurrency(monthlyStats.totalCost)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total no mês
            </p>
          </CardContent>
        </Card>

        <Card className="card-gradient-border card-fixed-height hover:shadow-glow-secondary transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lucro Diário Médio
            </CardTitle>
            <Target className="h-5 w-5 text-secondary" />
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <Skeleton className="h-9 w-32 mb-2" />
            ) : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-secondary whitespace-nowrap">
                  {formatCurrency(dailyAverage)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Média dos últimos {activeDaysCount} dias ativos
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Evolution Chart */}
      <Card className="card-gradient-border">
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">Evolução Semanal</CardTitle>
          <p className="text-sm text-muted-foreground">Vendas diárias da semana</p>
        </CardHeader>
        <CardContent className="h-[250px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData.length > 0 ? weeklyData : [{
            name: "Hoje",
            value: dailyProfit
          }]}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="hsl(var(--secondary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }} formatter={value => [`R$ ${value}`, 'Vendido']} />
              <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="card-gradient-border bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-secondary" />
                Meta do Mês
              </div>
              {!isEditingGoal ? (
                <button 
                  onClick={() => setIsEditingGoal(true)}
                  className="p-1.5 hover:bg-primary/10 rounded-md transition-colors"
                >
                  <Pencil className="h-4 w-4 text-primary" />
                </button>
              ) : (
                <div className="flex gap-1">
                  <button 
                    onClick={handleSaveGoal}
                    className="p-1.5 hover:bg-success/10 rounded-md transition-colors"
                  >
                    <Check className="h-4 w-4 text-success" />
                  </button>
                  <button 
                    onClick={() => {
                      setIsEditingGoal(false);
                      setGoalInput(monthlyGoal.toString());
                    }}
                    className="p-1.5 hover:bg-destructive/10 rounded-md transition-colors"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isEditingGoal ? (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Nova Meta (R$)</label>
                <Input
                  type="number"
                  value={goalInput === '0' ? '' : goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onFocus={(e) => { if (e.target.value === '0') e.target.value = ''; }}
                  placeholder="Digite a meta"
                  className="text-lg font-semibold"
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-semibold text-secondary">{calculateGoalProgress().toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-smooth shadow-glow-primary" style={{
                  width: `${calculateGoalProgress()}%`
                }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(monthlyStats.balance)} de {formatCurrency(monthlyGoal)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-gradient-border bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Motivação Orbis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
              <p className="text-sm font-medium mb-1">{motivation.icon} {motivation.title}</p>
              <p className="text-xs text-muted-foreground">
                {motivation.message}
              </p>
            </div>
            {todaySales && <div className="space-y-2 mt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-xs text-muted-foreground">Lucro Hoje</p>
                    <p className="text-sm font-bold text-success">R$ {dailyProfit.toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-xs text-muted-foreground">Calotes</p>
                    <p className="text-sm font-bold text-destructive">R$ {(todaySales.total_debt || 0).toFixed(2)}</p>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <p className="text-xs text-muted-foreground">Lançamentos Hoje</p>
                  <p className="text-sm font-bold text-primary">{todaySales.entry_count || 0}</p>
                </div>
              </div>}
          </CardContent>
        </Card>
      </div>
      
      <CardRegistrationModal 
        isOpen={showCardModal} 
        onClose={() => setShowCardModal(false)} 
      />
      
      {user && (
        <WeeklyPlanningModal
          userId={user.id}
          isOpen={showWeeklyPlanning}
          onClose={() => setShowWeeklyPlanning(false)}
        />
      )}

      {user && !isRestDay && (
        <DayStartPopup
          userId={user.id}
          onStart={() => {}}
          onEditPlanning={() => setShowWeeklyPlanning(true)}
        />
      )}
    </div>;
}