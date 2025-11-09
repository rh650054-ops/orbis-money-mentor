import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, DollarSign, AlertTriangle, ShoppingCart, Filter, X } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AIInsightsReport } from "@/components/AIInsightsReport";

interface SaleRecord {
  id: string;
  date: string;
  created_at: string;
  total_profit: number;
  pix_sales: number;
  cash_sales: number;
  card_sales: number;
  total_debt: number;
  cost: number;
  notes: string | null;
}

interface WeekData {
  name: string;
  value: number;
}

export default function History() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<SaleRecord[]>([]);
  const [weekData, setWeekData] = useState<WeekData[]>([]);
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadSalesHistory();
    }
  }, [user, loading, navigate]);

  const loadSalesHistory = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("daily_sales")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error loading history:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o histórico.",
        variant: "destructive"
      });
      return;
    }

    if (data) {
      setSalesHistory(data);
      setFilteredHistory(data);
      updateWeekData(data);
    }
  };

  const updateWeekData = (data: SaleRecord[]) => {
    // Get last 7 days
    const last7Days = data.slice(0, 7).reverse();
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    
    const weekChartData: WeekData[] = last7Days.map((sale) => {
      const date = new Date(sale.date + 'T00:00:00');
      return {
        name: weekDays[date.getDay()],
        value: sale.total_profit,
      };
    });

    setWeekData(weekChartData);
  };

  const applyFilter = () => {
    if (!filterStartDate && !filterEndDate) {
      toast({
        title: "Selecione as datas",
        description: "Escolha pelo menos uma data para filtrar.",
        variant: "destructive"
      });
      return;
    }

    let filtered = salesHistory;

    if (filterStartDate && filterEndDate) {
      filtered = salesHistory.filter(
        (sale) => sale.date >= filterStartDate && sale.date <= filterEndDate
      );
    } else if (filterStartDate) {
      filtered = salesHistory.filter((sale) => sale.date >= filterStartDate);
    } else if (filterEndDate) {
      filtered = salesHistory.filter((sale) => sale.date <= filterEndDate);
    }

    setFilteredHistory(filtered);
    updateWeekData(filtered);

    toast({
      title: "✅ Filtro aplicado!",
      description: `${filtered.length} lançamento(s) encontrado(s).`
    });
  };

  const clearFilter = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilteredHistory(salesHistory);
    updateWeekData(salesHistory);

    toast({
      title: "🔄 Filtros limpos",
      description: "Mostrando todos os lançamentos."
    });
  };

  const calculateGoalPercentage = (profit: number, cost: number, debt: number, goal: number = 200) => {
    const netProfit = profit - cost - debt;
    return Math.min((netProfit / goal) * 100, 100);
  };

  const calculateTotals = () => {
    const totalSales = filteredHistory.reduce((sum, sale) => sum + (sale.total_profit || 0), 0);
    const totalCost = filteredHistory.reduce((sum, sale) => sum + (sale.cost || 0), 0);
    const totalDebt = filteredHistory.reduce((sum, sale) => sum + (sale.total_debt || 0), 0);
    const netProfit = totalSales - totalCost - totalDebt;

    return { totalSales, totalCost, totalDebt, netProfit };
  };

  if (loading || !user) {
    return null;
  }

  const totals = calculateTotals();

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 animate-fade-in pb-20 md:pb-8">
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-3xl md:text-4xl font-bold gradient-text">Histórico de Lançamentos</h1>
        <p className="text-muted-foreground">
          Todos os seus lançamentos registrados • {filteredHistory.length} {filteredHistory.length === 1 ? 'registro' : 'registros'}
        </p>
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
              Aplicar filtro
            </Button>
            {(filterStartDate || filterEndDate) && (
              <Button onClick={clearFilter} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
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

      {/* Relatório de IA */}
      <AIInsightsReport userId={user.id} />

      {/* Evolução Semanal */}
      {weekData.length > 0 && (
        <Card className="card-gradient-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Evolução Semanal
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] md:h-[300px]">
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
          </CardContent>
        </Card>
      )}

      {/* Lançamentos */}
      <div className="space-y-4">
        {filteredHistory.length === 0 ? (
          <Card className="glass">
            <CardContent className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                Nenhum lançamento encontrado. Comece registrando suas vendas!
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredHistory.map((sale) => {
            const totalSold = sale.total_profit || 0;
            const cost = sale.cost || 0;
            const debt = sale.total_debt || 0;
            const netProfit = totalSold - cost - debt;
            const goal = 200;
            const percentage = calculateGoalPercentage(totalSold, cost, debt, goal);
            const isGoalReached = percentage >= 100;

            return (
              <Card key={sale.id} className="glass hover:shadow-glow-primary transition-smooth">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header com data e hora */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        <div>
                          <span className="font-medium">
                            {new Date(sale.date).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric"
                            })}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {new Date(sale.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                      </div>
                      {isGoalReached ? (
                        <Badge className="bg-success/20 text-success border-success/30">
                          🔥 Meta atingida!
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {percentage.toFixed(0)}% da meta
                        </Badge>
                      )}
                    </div>

                    {/* Valores principais */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="w-4 h-4 text-primary" />
                          <span className="text-xs text-muted-foreground">Total Vendido</span>
                        </div>
                        <p className="text-lg font-bold">
                          R$ {totalSold.toFixed(2)}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                        <div className="flex items-center gap-2 mb-1">
                          <ShoppingCart className="w-4 h-4 text-warning" />
                          <span className="text-xs text-muted-foreground">Gasto</span>
                        </div>
                        <p className="text-lg font-bold text-warning">
                          R$ {cost.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {debt > 0 && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                            <span className="text-xs text-muted-foreground">Calotes</span>
                          </div>
                          <p className="text-lg font-bold text-destructive">
                            R$ {debt.toFixed(2)}
                          </p>
                        </div>
                      )}

                      <div className={`p-3 rounded-lg ${netProfit >= 0 ? 'bg-success/10 border-success/20' : 'bg-destructive/10 border-destructive/20'} border`}>
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className={`w-4 h-4 ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`} />
                          <span className="text-xs text-muted-foreground">Lucro Líquido</span>
                        </div>
                        <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                          R$ {netProfit.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Barra de progresso da meta */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Meta Diária</span>
                        <span>R$ {goal.toFixed(2)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-secondary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Métodos de pagamento */}
                    {(sale.cash_sales > 0 || sale.pix_sales > 0 || sale.card_sales > 0) && (
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-2">Métodos de Pagamento:</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {sale.cash_sales > 0 && (
                            <div className="text-center">
                              <p className="text-muted-foreground">💵 Dinheiro</p>
                              <p className="font-semibold">R$ {sale.cash_sales.toFixed(2)}</p>
                            </div>
                          )}
                          {sale.pix_sales > 0 && (
                            <div className="text-center">
                              <p className="text-muted-foreground">📱 Pix</p>
                              <p className="font-semibold">R$ {sale.pix_sales.toFixed(2)}</p>
                            </div>
                          )}
                          {sale.card_sales > 0 && (
                            <div className="text-center">
                              <p className="text-muted-foreground">💳 Cartão</p>
                              <p className="font-semibold">R$ {sale.card_sales.toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notas */}
                    {sale.notes && (
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-xs text-muted-foreground">
                          {sale.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
