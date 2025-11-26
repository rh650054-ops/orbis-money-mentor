import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, TrendingUp, TrendingDown, Target, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DailyReportModalProps {
  open: boolean;
  onClose: () => void;
  report: {
    total_vendido: number;
    meta_dia: number;
    melhor_hora: number;
    pior_hora: number;
    ritmo_medio: number;
    porcentagem_meta: number;
    conselho: string;
    constancia: boolean;
  };
}

export const DailyReportModal = ({ open, onClose, report }: DailyReportModalProps) => {
  const navigate = useNavigate();

  const handleFinish = () => {
    onClose();
    navigate('/');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            Relatório do Dia — Parabéns Visionário! 🎯
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Main Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-4 rounded-xl border border-purple-500/20 text-center">
              <div className="text-xs text-muted-foreground mb-1">Total Vendido</div>
              <div className="text-2xl font-bold text-foreground">
                R$ {report.total_vendido.toFixed(2)}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-green-500/10 p-4 rounded-xl border border-blue-500/20 text-center">
              <div className="text-xs text-muted-foreground mb-1">% da Meta</div>
              <div className="text-2xl font-bold text-foreground">
                {report.porcentagem_meta.toFixed(0)}%
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-purple-500/10 p-4 rounded-xl border border-green-500/20 text-center">
              <div className="text-xs text-muted-foreground mb-1">Constância</div>
              <div className="text-2xl">
                {report.constancia ? "✔️" : "❌"}
              </div>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-muted-foreground">Meta do dia</span>
              </div>
              <span className="font-semibold">R$ {report.meta_dia.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-sm text-muted-foreground">Melhor hora</span>
              </div>
              <span className="font-semibold">Bloco {report.melhor_hora}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <span className="text-sm text-muted-foreground">Pior hora</span>
              </div>
              <span className="font-semibold">Bloco {report.pior_hora}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-muted-foreground">Ritmo médio</span>
              </div>
              <span className="font-semibold">R$ {report.ritmo_medio.toFixed(2)}/hora</span>
            </div>
          </div>

          {/* Advice Section */}
          <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 rounded-xl border border-purple-500/20">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
              <div>
                <div className="font-semibold text-foreground mb-1">Conselho do dia</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {report.conselho}
                </p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button 
            onClick={handleFinish}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            size="lg"
          >
            Finalizar Dia
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
