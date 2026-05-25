import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Target, CheckCircle2, XCircle, Sparkles } from "lucide-react";
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
  const pct = Math.min(report.percentageAchieved, 100);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[460px] bg-background border-border rounded-3xl p-0 overflow-hidden">
        <div className="relative p-6 space-y-5">
          <DialogHeader className="space-y-3">
            <div className="flex items-center justify-center">
              <div
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center border",
                  goalAchieved
                    ? "bg-primary/15 border-primary/40"
                    : "bg-secondary border-border"
                )}
              >
                {goalAchieved ? (
                  <Sparkles className="w-7 h-7 text-primary" />
                ) : (
                  <Target className="w-7 h-7 text-muted-foreground" />
                )}
              </div>
            </div>
            <DialogTitle className="text-center text-xl font-bold tracking-tight text-foreground">
              Relatório do Dia
            </DialogTitle>
            <p className="text-center text-xs text-muted-foreground -mt-1">
              {goalAchieved ? "Meta batida. Excelente execução." : "Continua firme. Cada dia é um passo."}
            </p>
          </DialogHeader>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total vendido</p>
              <p className="text-4xl font-black text-foreground tabular-nums">
                {formatCurrency(report.totalSold)}
              </p>
              <p className="text-xs text-muted-foreground">
                Meta: {formatCurrency(report.dailyGoal)}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Progresso</span>
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    goalAchieved ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {report.percentageAchieved.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {report.bestHour && (
              <div className="bg-card border border-border rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Melhor hora</p>
                </div>
                <p className="text-base font-bold text-foreground">H{report.bestHour.index + 1}</p>
                <p className="text-xs text-primary tabular-nums">{formatCurrency(report.bestHour.amount)}</p>
              </div>
            )}

            {report.worstHour && (
              <div className="bg-card border border-border rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Pior hora</p>
                </div>
                <p className="text-base font-bold text-foreground">H{report.worstHour.index + 1}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(report.worstHour.amount)}</p>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
              <span className="text-xs text-muted-foreground">Ritmo médio</span>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {formatCurrency(report.averageRhythm)}<span className="text-muted-foreground font-normal">/h</span>
              </span>
            </div>

            <div
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 border",
                report.consistency
                  ? "bg-primary/10 border-primary/30"
                  : "bg-card border-border"
              )}
            >
              {report.consistency ? (
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs font-semibold",
                  report.consistency ? "text-primary" : "text-foreground"
                )}>
                  {report.consistency ? "Constância atingida" : "Constância não atingida"}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  {report.consistency
                    ? "Todos os blocos do dia preenchidos."
                    : "Complete todos os blocos pra manter."}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Conselho do dia
                </p>
                <p className="text-xs text-foreground leading-relaxed">
                  {report.advice}
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={onClose}
            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wide transition-colors"
          >
            Finalizar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
