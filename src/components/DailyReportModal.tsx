import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, CheckCircle2, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: {
    totalSold: number;
    dailyGoal: number;
    percentageAchieved: number;
    bestHour: { index: number; amount: number } | null;
    worstHour: { index: number; amount: number } | null;
    averageRhythm: number;
    consistency: boolean;
    advice: string;
  };
}

export default function DailyReportModal({ isOpen, onClose, report }: DailyReportModalProps) {
  const goalAchieved = report.percentageAchieved >= 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-black/95 border-white/10 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              goalAchieved 
                ? "bg-gradient-to-br from-green-500 to-emerald-600" 
                : "bg-gradient-to-br from-blue-500 to-purple-600"
            )}>
              {goalAchieved ? (
                <CheckCircle2 className="w-6 h-6 text-white" />
              ) : (
                <Target className="w-6 h-6 text-white" />
              )}
            </div>
            <span className="bg-gradient-to-r from-blue-400 via-purple-500 to-blue-600 bg-clip-text text-transparent">
              Relatório do Dia
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Total do Dia */}
          <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-blue-500/10 to-purple-600/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Vendido</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                  {formatCurrency(report.totalSold)}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Meta do Dia</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {formatCurrency(report.dailyGoal)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Percentual da Meta */}
          <Card className={cn(
            "overflow-hidden border-2 backdrop-blur-sm",
            goalAchieved 
              ? "border-green-500 bg-gradient-to-br from-green-600/20 to-emerald-700/20" 
              : "border-blue-500 bg-gradient-to-br from-blue-600/20 to-purple-700/20"
          )}>
            <CardContent className="p-6 text-center">
              <div className={cn(
                "text-6xl font-bold mb-2",
                goalAchieved ? "text-green-500" : "text-blue-400"
              )}>
                {report.percentageAchieved.toFixed(0)}%
              </div>
              <p className="text-sm text-muted-foreground">
                {goalAchieved ? "🔥 Meta batida! Parabéns, Visionário!" : "Continue assim, você está no caminho!"}
              </p>
            </CardContent>
          </Card>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 gap-4">
            {/* Melhor Hora */}
            {report.bestHour && (
              <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-green-600/20 to-emerald-700/20 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <p className="text-xs text-muted-foreground">Melhor Hora</p>
                  </div>
                  <p className="text-lg font-bold text-green-500">H{report.bestHour.index + 1}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(report.bestHour.amount)}</p>
                </CardContent>
              </Card>
            )}

            {/* Pior Hora */}
            {report.worstHour && (
              <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-red-600/20 to-rose-700/20 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <p className="text-xs text-muted-foreground">Pior Hora</p>
                  </div>
                  <p className="text-lg font-bold text-red-500">H{report.worstHour.index + 1}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(report.worstHour.amount)}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Ritmo Médio */}
          <Card className="overflow-hidden border-white/10 bg-black/40 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Ritmo Médio</p>
                <p className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                  {formatCurrency(report.averageRhythm)}/hora
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Constância */}
          <Card className={cn(
            "overflow-hidden border-2 backdrop-blur-sm",
            report.consistency 
              ? "border-green-500 bg-gradient-to-br from-green-600/20 to-emerald-700/20" 
              : "border-yellow-500 bg-gradient-to-br from-yellow-600/20 to-orange-700/20"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {report.consistency ? (
                  <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-8 h-8 text-yellow-500 flex-shrink-0" />
                )}
                <div>
                  <p className={cn(
                    "text-sm font-semibold mb-1",
                    report.consistency ? "text-green-500" : "text-yellow-500"
                  )}>
                    {report.consistency ? "Constância Atingida!" : "Constância Não Atingida"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {report.consistency 
                      ? "Você preencheu todos os blocos do dia! 🔥" 
                      : "Complete todos os blocos para manter sua constância."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conselho do Dia */}
          <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-purple-600/20 to-blue-700/20 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">💡</div>
                <div>
                  <p className="text-sm font-semibold text-purple-400 mb-2">Conselho do Dia</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {report.advice}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Button
          onClick={onClose}
          className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg"
        >
          Finalizar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
