import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Banknote, CreditCard, AlertCircle, Calendar, TrendingUp, ShoppingCart, Filter, X } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface DayRecord {
  date: string;
  total_profit: number;
  pix_sales: number;
  cash_sales: number;
  card_sales: number;
  total_debt: number;
  cost: number;
}

interface WeekData {
  name: string;
  value: number;
}

const paymentIcons = {
  pix: Smartphone,
  cash: Banknote,
  card: CreditCard,
  debt: AlertCircle,
  cost: ShoppingCart,
};

const paymentColors = {
  pix: "text-secondary",
  cash: "text-success",
  card: "text-primary",
  debt: "text-destructive",
  cost: "text-warning",
};

export default function History() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [historyData, setHistoryData] = useState<DayRecord[]>([]);
  const [weekData, setWeekData] = useState<WeekData[]>([]);
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");
  const [filteredData, setFilteredData] = useState<DayRecord[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadHistoryData();
    }
  }, [user, loading, navigate]);

  const loadHistoryData = async () => {
    if (!user) return;

    // Carregar últimos 30 dias de vendas
    const { data: salesData, error } = await supabase
      .from("daily_sales")
      .select("date, total_profit, pix_sales, cash_sales, card_sales, total_debt, cost")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(30);

    if (error) {
      console.error("Error loading history:", error);
      return;
    }

    if (salesData) {
      // Agrupar por data (pode haver múltiplos registros por dia)
      const groupedByDate: { [key: string]: DayRecord } = {};
      
      salesData.forEach((sale: any) => {
        const date = sale.date;
        if (!groupedByDate[date]) {
          groupedByDate[date] = {
            date,
            total_profit: 0,
            pix_sales: 0,
            cash_sales: 0,
            card_sales: 0,
            total_debt: 0,
            cost: 0,
          };
        }
        groupedByDate[date].total_profit += sale.total_profit || 0;
        groupedByDate[date].pix_sales += sale.pix_sales || 0;
        groupedByDate[date].cash_sales += sale.cash_sales || 0;
        groupedByDate[date].card_sales += sale.card_sales || 0;
        groupedByDate[date].total_debt += sale.total_debt || 0;
        groupedByDate[date].cost += sale.cost || 0;
      });

      const formattedData: DayRecord[] = Object.values(groupedByDate);

      setHistoryData(formattedData);
      setFilteredData(formattedData);

      // Calcular dados da semana (últimos 7 dias)
      updateWeekData(formattedData);
    }
  };

  const updateWeekData = (data: DayRecord[]) => {
    const last7Days = data.slice(0, 7).reverse();
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    
    const weekChartData: WeekData[] = last7Days.map((day) => {
      const date = new Date(day.date + 'T00:00:00');
      return {
        name: weekDays[date.getDay()],
        value: day.total_profit,
      };
    });

    setWeekData(weekChartData);
  };

  const applyFilter = () => {
    if (!filterStartDate && !filterEndDate) {
      toast({
        title: "Escolha uma data",
        description: "Selecione pelo menos uma data para filtrar.",
        variant: "destructive"
      });
      return;
    }

    let filtered = historyData;

    if (filterStartDate && filterEndDate) {
      // Filtro por intervalo
      filtered = historyData.filter(
        (day) => day.date >= filterStartDate && day.date <= filterEndDate
      );
    } else if (filterStartDate) {
      // Filtro por data única
      filtered = historyData.filter((day) => day.date === filterStartDate);
    } else if (filterEndDate) {
      // Filtro por data única (end date)
      filtered = historyData.filter((day) => day.date === filterEndDate);
    }

    setFilteredData(filtered);
    updateWeekData(filtered);

    // Persistir filtros no localStorage
    localStorage.setItem('historyFilter', JSON.stringify({ filterStartDate, filterEndDate }));

    toast({
      title: "Filtro aplicado!",
      description: `${filtered.length} registro(s) encontrado(s).`
    });
  };

  const clearFilter = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilteredData(historyData);
    updateWeekData(historyData);
    localStorage.removeItem('historyFilter');

    toast({
      title: "Filtros limpos",
      description: "Mostrando todos os registros."
    });
  };

  const calculateTotals = () => {
    const totalSales = filteredData.reduce((sum, day) => sum + (day.pix_sales + day.cash_sales + day.card_sales), 0);
    const totalCost = filteredData.reduce((sum, day) => sum + day.cost, 0);
    const totalDebt = filteredData.reduce((sum, day) => sum + day.total_debt, 0);
    const netProfit = totalSales - totalCost - totalDebt;

    return { totalSales, totalCost, totalDebt, netProfit };
  };

  // Carregar filtros persistidos ao montar o componente
  useEffect(() => {
    const savedFilter = localStorage.getItem('historyFilter');
    if (savedFilter) {
      const { filterStartDate: start, filterEndDate: end } = JSON.parse(savedFilter);
      if (start) setFilterStartDate(start);
      if (end) setFilterEndDate(end);
    }
  }, []);

  // Aplicar filtro automaticamente quando os dados forem carregados e houver filtros salvos
  useEffect(() => {
    if (historyData.length > 0 && (filterStartDate || filterEndDate)) {
      applyFilter();
    }
  }, [historyData]);

  if (loading || !user) {
    return null;
  }

  const totals = calculateTotals();

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 animate-fade-in pb-20 md:pb-8">
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-3xl md:text-4xl font-bold gradient-text">Histórico</h1>
        <p className="text-muted-foreground">Acompanhe sua evolução</p>
      </div>

      {/* Filtros */}
      <Card className="card-gradient-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Filtros Inteligentes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data inicial</Label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>Data final</Label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                min={filterStartDate}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={applyFilter} className="flex-1">
              <Filter className="h-4 w-4 mr-2" />
              🔎 Aplicar filtro
            </Button>
            <Button onClick={clearFilter} variant="outline">
              <X className="h-4 w-4 mr-2" />
              🔄 Limpar
            </Button>
          </div>

          {/* Totais */}
          {(filterStartDate || filterEndDate) && (
            <div className="pt-4 border-t border-border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">💰 Vendas totais</p>
                  <p className="text-lg font-bold text-success">R$ {totals.totalSales.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">📦 Gasto em merc.</p>
                  <p className="text-lg font-bold text-warning">R$ {totals.totalCost.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">❌ Calotes</p>
                  <p className="text-lg font-bold text-destructive">R$ {totals.totalDebt.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">⚡ Lucro líquido</p>
                  <p className="text-lg font-bold gradient-text">R$ {totals.netProfit.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evolução Semanal */}
      <Card className="card-gradient-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[250px] md:h-[300px]">
          {weekData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="50%" stopColor="hsl(var(--secondary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`R$ ${Number(value).toFixed(2)}`, 'Lucro']}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Nenhum dado disponível. Registre suas vendas para ver o gráfico.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registros Diários */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Registros Diários</h2>
        {filteredData.length > 0 ? (
          filteredData.map((day) => (
            <Card key={day.date} className="card-gradient-border hover:shadow-glow-primary transition-smooth">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-secondary" />
                    <CardTitle className="text-lg">
                      {new Date(day.date + 'T00:00:00').toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                    </CardTitle>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Lucro</p>
                    <p className="text-2xl font-bold gradient-text">R$ {day.total_profit.toFixed(2)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: "pix", label: "PIX", value: day.pix_sales },
                    { key: "cash", label: "Dinheiro", value: day.cash_sales },
                    { key: "card", label: "Cartão", value: day.card_sales },
                    { key: "debt", label: "Calote", value: day.total_debt },
                    { key: "cost", label: "Gasto Merc.", value: day.cost },
                  ].map((payment) => {
                    const Icon = paymentIcons[payment.key as keyof typeof paymentIcons];
                    const colorClass = paymentColors[payment.key as keyof typeof paymentColors];
                    
                    return (
                      <div key={payment.key} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                        <Icon className={`h-5 w-5 ${colorClass}`} />
                        <div>
                          <p className="text-xs text-muted-foreground">{payment.label}</p>
                          <p className={`text-sm font-semibold ${colorClass}`}>
                            R$ {Number(payment.value).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="card-gradient-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro encontrado.</p>
              <p className="text-sm mt-2">Comece a registrar suas vendas diárias!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
