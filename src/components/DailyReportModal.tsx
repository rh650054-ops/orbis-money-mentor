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
      <DialogContent className="sm:max-w-[460px] bg-[#0D0D0D] border border-white/10 rounded-3xl p-0 overflow-hidden">
        {/* Glow background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className={cn(
              "absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full blur-3xl opacity-30",
              goalAchieved ? "bg-[#F4A100]" : "bg-[#6B21A8]"
            )}
          />
        </div>

        <div className="relative p-6 space-y-5">
          <DialogHeader className="space-y-3">
            <div className="flex items-center justify-center">
              <div
                className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center border",
                  goalAchieved
                    ? "bg-[#F4A100]/15 border-[#F4A100]/40"
                    : "bg-[#6B21A8]/15 border-[#6B21A8]/40"
                )}
              >
                {goalAchieved ? (
                  <Sparkles className="w-7 h-7 text-[#F4A100]" />
                ) : (
                  <Target className="w-7 h-7 text-[#A78BFA]" />
                )}
              </div>
            </div>
            <DialogTitle className="text-center text-xl font-bold tracking-tight text-white">
              Relatório do Dia
            </DialogTitle>
            <p className="text-center text-xs text-neutral-500 -mt-1">
              {goalAchieved ? "Meta batida. Excelente execução." : "Continua firme. Cada dia é um passo."}
            </p>
          </DialogHeader>

          {/* Hero: Total + % */}
          <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Total vendido</p>
              <p className="text-4xl font-black text-white tabular-nums">
                {formatCurrency(report.totalSold)}
              </p>
              <p className="text-xs text-neutral-500">
                Meta: {formatCurrency(report.dailyGoal)}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    goalAchieved
                      ? "bg-gradient-to-r from-[#F4A100] to-[#FFB840]"
                      : "bg-gradient-to-r from-[#6B21A8] to-[#A78BFA]"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Progresso</span>
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    goalAchieved ? "text-[#F4A100]" : "text-[#A78BFA]"
                  )}
                >
                  {report.percentageAchieved.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {report.bestHour && (
              <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-[#F4A100]" />
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Melhor hora</p>
                </div>
                <p className="text-base font-bold text-white">H{report.bestHour.index + 1}</p>
                <p className="text-xs text-[#F4A100] tabular-nums">{formatCurrency(report.bestHour.amount)}</p>
              </div>
            )}

            {report.worstHour && (
              <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-3.5 h-3.5 text-neutral-500" />
                  <p className="text-[10px] uppercase tracking-wider text-neutral-500">Pior hora</p>
                </div>
                <p className="text-base font-bold text-white">H{report.worstHour.index + 1}</p>
                <p className="text-xs text-neutral-400 tabular-nums">{formatCurrency(report.worstHour.amount)}</p>
              </div>
            )}
          </div>

          {/* Ritmo + Constância */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between bg-[#1A1A1A] border border-white/5 rounded-xl px-4 py-3">
              <span className="text-xs text-neutral-400">Ritmo médio</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {formatCurrency(report.averageRhythm)}<span className="text-neutral-500 font-normal">/h</span>
              </span>
            </div>

            <div
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 border",
                report.consistency
                  ? "bg-[#F4A100]/8 border-[#F4A100]/30"
                  : "bg-[#1A1A1A] border-white/5"
              )}
            >
              {report.consistency ? (
                <CheckCircle2 className="w-5 h-5 text-[#F4A100] flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-neutral-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-xs font-semibold",
                  report.consistency ? "text-[#F4A100]" : "text-neutral-300"
                )}>
                  {report.consistency ? "Constância atingida" : "Constância não atingida"}
                </p>
                <p className="text-[10px] text-neutral-500 leading-snug">
                  {report.consistency
                    ? "Todos os blocos do dia preenchidos."
                    : "Complete todos os blocos pra manter."}
                </p>
              </div>
            </div>
          </div>

          {/* Conselho */}
          <div className="bg-gradient-to-br from-[#6B21A8]/15 to-[#1A1A1A] border border-[#6B21A8]/25 rounded-xl p-4">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#6B21A8]/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-[#A78BFA]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[#A78BFA] font-semibold mb-1">
                  Conselho do dia
                </p>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {report.advice}
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={onClose}
            className="relative w-full h-12 rounded-xl bg-[#F4A100] hover:bg-[#FFB840] text-black font-bold text-sm tracking-wide transition-all shadow-[0_0_24px_-4px_rgba(244,161,0,0.5)] overflow-hidden group"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative">Finalizar</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
