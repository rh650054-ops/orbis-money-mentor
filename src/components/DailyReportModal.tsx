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
      <DialogContent className="sm:max-w-[600px] bg-background/95 border border-border backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              goalAchieved
                ? "bg-gradient-to-br from-success to-success/70"
                : "bg-gradient-primary"
            )}>
              {goalAchieved ? (
                <CheckCircle2 className="w-6 h-6 text-success-foreground" />
              ) : (
                <Target className="w-6 h-6 text-primary-foreground" />
              )}
            </div>
            <span className="gradient-text">
              Relatório do Dia
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Total do Dia */}
          <Card className="overflow-hidden border-border bg-gradient-gold-soft backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Total Vendido</p>
                <p className="text-4xl font-bold gradient-text">
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
              ? "border-success bg-success/10"
              : "border-primary/40 bg-primary/10"
          )}>
            <CardContent className="p-6 text-center">
              <div className={cn(
                "text-6xl font-bold mb-2",
                goalAchieved ? "text-success" : "text-primary"
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
            {report.bestHour && (
              <Card className="overflow-hidden border-border bg-success/10 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-success" />
                    <p className="text-xs text-muted-foreground">Melhor Hora</p>
                  </div>
                  <p className="text-lg font-bold text-success">H{report.bestHour.index + 1}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(report.bestHour.amount)}</p>
                </CardContent>
              </Card>
            )}

            {report.worstHour && (
              <Card className="overflow-hidden border-border bg-destructive/10 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-destructive" />
                    <p className="text-xs text-muted-foreground">Pior Hora</p>
                  </div>
                  <p className="text-lg font-bold text-destructive">H{report.worstHour.index + 1}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(report.worstHour.amount)}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Ritmo Médio */}
          <Card className="overflow-hidden border-border bg-card/60 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Ritmo Médio</p>
                <p className="text-xl font-bold gradient-text">
                  {formatCurrency(report.averageRhythm)}/hora
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Constância */}
          <Card className={cn(
            "overflow-hidden border-2 backdrop-blur-sm",
            report.consistency
              ? "border-success bg-success/10"
              : "border-warning bg-warning/10"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {report.consistency ? (
                  <CheckCircle2 className="w-8 h-8 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="w-8 h-8 text-warning flex-shrink-0" />
                )}
                <div>
                  <p className={cn(
                    "text-sm font-semibold mb-1",
                    report.consistency ? "text-success" : "text-warning"
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
          <Card className="overflow-hidden border-primary/30 bg-gradient-gold-soft backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">💡</div>
                <div>
                  <p className="text-sm font-semibold text-primary mb-2">Conselho do Dia</p>
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
          className="w-full h-14 text-lg font-semibold bg-gradient-primary text-primary-foreground hover:opacity-90 glow-primary"
        >
          Finalizar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
