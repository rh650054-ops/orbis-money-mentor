import { Card, CardContent } from "@/components/ui/card";
import { Banknote, CreditCard, Smartphone, AlertTriangle, TrendingUp, Calculator, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useDailyBlockStats } from "@/hooks/useHourlyBlocks";

interface DashboardBlockStatsProps {
  userId: string;
  date?: string;
}

export function DashboardBlockStats({
  userId,
  date
}: DashboardBlockStatsProps) {
  const {
    stats,
    loading
  } = useDailyBlockStats(userId, date);

  if (loading) {
    return <Card className="card-gradient-border animate-pulse">
        <CardContent className="p-4">
          <div className="h-24 bg-muted/20 rounded-lg" />
        </CardContent>
      </Card>;
  }

  if (!stats || stats.totalBlocks === 0) {
    return null;
  }

  // Calculate derived values
  const faturamentoBruto = stats.totalVendido;
  const caloteDoDia = stats.totalCalote;
  const faturamentoLiquido = faturamentoBruto - caloteDoDia;

  return <Card className="card-gradient-border overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header with Bruto/Calote/Líquido Summary */}
        <div className="grid grid-cols-3 gap-2">
          {/* Faturamento Bruto */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-primary/20 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calculator className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xs text-muted-foreground">Bruto</p>
            <p className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              {formatCurrency(faturamentoBruto)}
            </p>
          </div>

          {/* Calote do Dia */}
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-xs text-muted-foreground">Calotes</p>
            <p className="text-lg font-bold text-red-400">
              {formatCurrency(caloteDoDia)}
            </p>
          </div>

          {/* Faturamento Líquido */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Wallet className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-xs text-muted-foreground">Líquido</p>
            <p className="text-lg font-bold text-green-400">
              {formatCurrency(faturamentoLiquido)}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Resumo por Forma de Pagamento
            </h3>
            <span className="text-xs text-muted-foreground">
              {stats.blocksCompleted}/{stats.totalBlocks} blocos
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {/* Dinheiro */}
            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
              <Banknote className="w-4 h-4 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Dinheiro</p>
              <p className="text-sm font-bold text-green-500">
                {formatCurrency(stats.totalDinheiro)}
              </p>
            </div>

            {/* Cartão */}
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
              <CreditCard className="w-4 h-4 text-blue-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Cartão</p>
              <p className="text-sm font-bold text-blue-500">
                {formatCurrency(stats.totalCartao)}
              </p>
            </div>

            {/* Pix */}
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
              <Smartphone className="w-4 h-4 text-purple-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Pix</p>
              <p className="text-sm font-bold text-purple-500">
                {formatCurrency(stats.totalPix)}
              </p>
            </div>

            {/* Calotes detail */}
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
              <AlertTriangle className="w-4 h-4 text-red-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Calotes</p>
              <p className="text-sm font-bold text-red-500">
                {formatCurrency(stats.totalCalote)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>;
}