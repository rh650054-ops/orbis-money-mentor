import { Card, CardContent } from "@/components/ui/card";
import { Banknote, CreditCard, Smartphone, AlertTriangle, TrendingUp, Calculator, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { DailyBlockStats } from "@/hooks/useHourlyBlocks";

interface DashboardBlockStatsProps {
  stats: DailyBlockStats;
}

export function DashboardBlockStats({ stats }: DashboardBlockStatsProps) {
  if (!stats || stats.totalBlocks === 0) {
    return null;
  }

  // Calculate derived values
  const faturamentoBruto = stats.totalVendido;
  const caloteDoDia = stats.totalCalote;
  const faturamentoLiquido = faturamentoBruto - caloteDoDia;

  return (
    <Card className="card-gradient-border overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header with Bruto/Calote/Líquido Summary */}
        <div className="grid grid-cols-3 gap-2">
          {/* Faturamento Bruto */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calculator className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs text-muted-foreground">Bruto</p>
            <p className="text-lg font-bold text-amber-400">
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
          <div className="p-3 rounded-xl bg-white/5 border border-white/15 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs text-muted-foreground">Líquido</p>
            <p className="text-lg font-bold text-white">
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
    </Card>
  );
}