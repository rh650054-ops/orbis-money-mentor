import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertTriangle, Target, Clock, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface DailyDashboardProps {
  userId: string;
}

interface DailySummary {
  vendas: number;
  meta: number;
  percentualMeta: number;
  lucroLiquido: number;
  gastoMercadoria: number;
  calotes: number;
  visionPoints: number;
}

export const DailyDashboard = ({ userId }: DailyDashboardProps) => {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDailySummary();

    // Realtime subscription para atualizar quando houver mudanças
    const channel = supabase
      .channel('daily-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_sales',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadDailySummary();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadDailySummary();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadDailySummary = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Carregar vendas do dia
    const { data: todaySales } = await supabase
      .from("daily_sales")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today);

    // Carregar perfil para meta e vision points
    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_sales_goal, vision_points")
      .eq("user_id", userId)
      .single();

    if (todaySales && profile) {
      const totalVendas = todaySales.reduce((sum, sale) => sum + (sale.total_profit || 0), 0);
      const totalCusto = todaySales.reduce((sum, sale) => sum + (sale.cost || 0), 0);
      const totalCalotes = todaySales.reduce((sum, sale) => sum + (sale.total_debt || 0), 0);
      const lucroLiquido = totalVendas - totalCusto - totalCalotes;
      const meta = profile.daily_sales_goal || 200;
      const percentualMeta = (totalVendas / meta) * 100;

      setSummary({
        vendas: totalVendas,
        meta,
        percentualMeta,
        lucroLiquido,
        gastoMercadoria: totalCusto,
        calotes: totalCalotes,
        visionPoints: profile.vision_points || 0,
      });
    } else {
      setSummary({
        vendas: 0,
        meta: profile?.daily_sales_goal || 200,
        percentualMeta: 0,
        lucroLiquido: 0,
        gastoMercadoria: 0,
        calotes: 0,
        visionPoints: profile?.vision_points || 0,
      });
    }

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="card-gradient-border">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">Dashboard Diário</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Meta de Vendas */}
        <Card className="card-gradient-border hover:shadow-glow-primary transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Meta do Dia
            </CardTitle>
            <Target className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {summary.vendas.toFixed(2)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    summary.percentualMeta >= 100
                      ? "bg-success"
                      : summary.percentualMeta >= 50
                      ? "bg-warning"
                      : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(summary.percentualMeta, 100)}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                {summary.percentualMeta.toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Meta: R$ {summary.meta.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Lucro Líquido */}
        <Card className="card-gradient-border hover:shadow-glow-success transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lucro Líquido
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {summary.lucroLiquido.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Vendas - Custos - Calotes
            </p>
          </CardContent>
        </Card>

        {/* Gasto de Mercadoria */}
        <Card className="card-gradient-border hover:shadow-glow-warning transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo Mercadoria
            </CardTitle>
            <DollarSign className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              R$ {summary.gastoMercadoria.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Investimento do dia
            </p>
          </CardContent>
        </Card>

        {/* Calotes */}
        <Card className="card-gradient-border hover:shadow-glow-destructive transition-smooth">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Calotes
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              R$ {summary.calotes.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Perdas do dia
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Vision Points */}
      <Card className="card-gradient-border hover:shadow-glow-secondary transition-smooth">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-secondary animate-pulse" />
              <div>
                <p className="text-sm text-muted-foreground">Vision Points</p>
                <p className="text-3xl font-bold gradient-text">{summary.visionPoints} VP</p>
              </div>
            </div>
            {summary.visionPoints >= 100 && (
              <div className="text-right">
                <p className="text-sm font-semibold text-secondary">
                  {summary.visionPoints >= 500 ? "👑 Lendário!" : 
                   summary.visionPoints >= 200 ? "⭐ Avançado!" : 
                   "🌟 Em ascensão!"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
