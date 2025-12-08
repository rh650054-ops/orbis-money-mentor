import { Card, CardContent } from "@/components/ui/card";
import { Banknote, CreditCard, Smartphone, AlertTriangle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useDailyBlockStats } from "@/hooks/useHourlyBlocks";

interface DashboardBlockStatsProps {
  userId: string;
  date?: string;
}

export function DashboardBlockStats({ userId, date }: DashboardBlockStatsProps) {
  const { stats, loading } = useDailyBlockStats(userId, date);

  if (loading) {
    return (
      <Card className="card-gradient-border animate-pulse">
        <CardContent className="p-4">
          <div className="h-24 bg-muted/20 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalBlocks === 0) {
    return null;
  }

  return (
    <Card className="card-gradient-border">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Resumo do Ritmo
          </h3>
          <span className="text-sm text-muted-foreground">
            {stats.blocksCompleted}/{stats.totalBlocks} blocos
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Dinheiro */}
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Dinheiro</span>
            </div>
            <p className="text-lg font-bold text-green-500">
              {formatCurrency(stats.totalDinheiro)}
            </p>
          </div>

          {/* Cartão */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Cartão</span>
            </div>
            <p className="text-lg font-bold text-blue-500">
              {formatCurrency(stats.totalCartao)}
            </p>
          </div>

          {/* Pix */}
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Pix</span>
            </div>
            <p className="text-lg font-bold text-purple-500">
              {formatCurrency(stats.totalPix)}
            </p>
          </div>

          {/* Calotes */}
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Calotes</span>
            </div>
            <p className="text-lg font-bold text-red-500">
              {formatCurrency(stats.totalCalote)}
            </p>
          </div>
        </div>

        {/* Total */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Vendido (Ritmo)</span>
            <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {formatCurrency(stats.totalVendido)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
