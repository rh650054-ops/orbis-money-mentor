import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, TrendingDown, Target, Flame, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [todaySales, setTodaySales] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    variation: 0
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadDashboardData();
    }
  }, [user, loading, navigate]);

  const loadDashboardData = async () => {
    if (!user) return;

    // Carregar todas as vendas de hoje e agregar
    const today = new Date().toISOString().split('T')[0];
    const { data: todayData } = await supabase
      .from("daily_sales")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today);

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
    const { data: weekData } = await supabase
      .from("daily_sales")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", sevenDaysAgo.toISOString().split('T')[0])
      .order("date", { ascending: true });

    if (weekData) {
      const formattedWeekData = weekData.map(day => ({
        name: new Date(day.date).toLocaleDateString("pt-BR", { weekday: "short" }),
        value: day.total_profit || 0
      }));
      setWeeklyData(formattedWeekData);
    }

    // Calcular estatísticas mensais
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    const { data: monthData } = await supabase
      .from("daily_sales")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", firstDayOfMonth.toISOString().split('T')[0]);

    if (monthData) {
      const totalIncome = monthData.reduce((sum, day) => sum + (day.total_profit || 0), 0);
      const totalExpenses = monthData.reduce((sum, day) => sum + (day.total_debt || 0), 0);
      const balance = totalIncome - totalExpenses;
      
      setMonthlyStats({
        totalIncome,
        totalExpenses,
        balance,
        variation: totalIncome > 0 ? ((balance / totalIncome) * 100) : 0
      });
    }
  };

  const calculateGoalProgress = () => {
    const goal = 4200;
    const progress = (monthlyStats.balance / goal) * 100;
    return Math.min(progress, 100);
  };

  const getMotivationMessage = () => {
    if (!todaySales) {
      return { icon: "💪", title: "Comece seu dia!", message: "Registre suas primeiras vendas" };
    }
    
    const profit = todaySales.total_profit || 0;
    const goal = 200; // Meta diária padrão
    const percentage = (profit / goal) * 100;

    if (percentage >= 100) {
      return { icon: "🔥", title: "Meta atingida!", message: `Você bateu ${percentage.toFixed(0)}% da meta hoje` };
    } else if (percentage >= 50) {
      return { icon: "💪", title: "Continue evoluindo!", message: `Você está perto! ${percentage.toFixed(0)}% da meta` };
    } else {
      return { icon: "⚡", title: "Vamos lá!", message: "Cada venda conta para seu sucesso" };
    }
  };

  if (loading || !user) {
    return null;
  }

  const motivation = getMotivationMessage();
  const dailyProfit = todaySales?.total_profit || 0;

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Hero Section */}
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white">
          DOMINE SEUS NÚMEROS
        </h1>
        <p className="text-xl md:text-2xl font-light" style={{ color: 'hsl(var(--secondary))' }}>
          domine seu futuro
        </p>
        <p className="text-muted-foreground text-sm md:text-base mt-2">
          Acompanhe suas vendas, metas e evolução diária
        </p>
      </div>

    {/* Financial Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-gradient-border hover:shadow-glow-primary transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Total
            </CardTitle>
            <DollarSign className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold">
              R$ {monthlyStats.balance.toFixed(2)}
            </div>
            <p className="text-xs text-success mt-1">
              {monthlyStats.variation > 0 ? "+" : ""}{monthlyStats.variation.toFixed(1)}% este mês
            </p>
          </CardContent>
        </Card>

        <Card className="card-gradient-border hover:shadow-glow-success transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entradas
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-success">
              R$ {monthlyStats.totalIncome.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total no mês
            </p>
          </CardContent>
        </Card>

        <Card className="card-gradient-border hover:shadow-glow-primary transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saídas
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-destructive">
              R$ {monthlyStats.totalExpenses.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Calotes no mês
            </p>
          </CardContent>
        </Card>

        <Card className="card-gradient-border hover:shadow-glow-secondary transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lucro Diário
            </CardTitle>
            <Target className="h-5 w-5 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold text-secondary">
              R$ {dailyProfit.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Hoje
            </p>
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
            <AreaChart data={weeklyData.length > 0 ? weeklyData : [{ name: "Hoje", value: dailyProfit }]}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="hsl(var(--secondary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value) => [`R$ ${value}`, 'Vendido']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="card-gradient-border bg-gradient-to-br from-card to-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-secondary" />
              Meta do Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-semibold text-secondary">{calculateGoalProgress().toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-primary via-secondary to-primary transition-smooth shadow-glow-primary"
                  style={{ width: `${calculateGoalProgress()}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                R$ {monthlyStats.balance.toFixed(2)} de R$ 4.200,00
              </p>
            </div>
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
            {todaySales && (
              <div className="space-y-2 mt-3">
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
