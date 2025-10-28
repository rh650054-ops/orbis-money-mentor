import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, TrendingUp, TrendingDown, DollarSign, AlertTriangle, ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import DailySalesForm from "@/components/DailySalesForm";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function Transactions() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [salesHistory, setSalesHistory] = useState<any[]>([]);

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
      .order("date", { ascending: false })
      .limit(30);

    if (data && !error) {
      setSalesHistory(data);
    }
  };

  const calculateGoalPercentage = (profit: number, goal: number = 200) => {
    return Math.min((profit / goal) * 100, 100);
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Formulário de Registro de Vendas */}
      <DailySalesForm userId={user.id} onSaved={loadSalesHistory} />

      <div>
        <h1 className="text-3xl font-bold gradient-text">Histórico de Lançamentos</h1>
        <p className="text-muted-foreground mt-1">
          Todos os seus lançamentos registrados • {salesHistory.length} {salesHistory.length === 1 ? 'registro' : 'registros'}
        </p>
      </div>

      {/* Sales History */}
      <div className="space-y-3">
        {salesHistory.length === 0 ? (
          <Card className="glass">
            <CardContent className="p-8 text-center">
              <DollarSign className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                Nenhum lançamento registrado ainda. Comece registrando seus lançamentos acima!
              </p>
            </CardContent>
          </Card>
        ) : (
          salesHistory.map((sale) => {
            const totalSold = sale.total_profit || 0;
            const cost = sale.cost || 0;
            const debt = sale.total_debt || 0;
            const netProfit = totalSold - cost - debt;
            const goal = 200; // Meta diária padrão
            const percentage = calculateGoalPercentage(netProfit, goal);
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
                              <p className="font-semibold">R$ {(sale.cash_sales || 0).toFixed(2)}</p>
                            </div>
                          )}
                          {sale.pix_sales > 0 && (
                            <div className="text-center">
                              <p className="text-muted-foreground">📱 Pix</p>
                              <p className="font-semibold">R$ {(sale.pix_sales || 0).toFixed(2)}</p>
                            </div>
                          )}
                          {sale.card_sales > 0 && (
                            <div className="text-center">
                              <p className="text-muted-foreground">💳 Cartão</p>
                              <p className="font-semibold">R$ {(sale.card_sales || 0).toFixed(2)}</p>
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
