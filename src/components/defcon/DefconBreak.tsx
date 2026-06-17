import { FastForward } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";

interface DefconBreakProps {
  breakRemaining: number;
  currentBlockIndex: number;
  blockSold: number;
  onSkip?: () => void;
}

export function DefconBreak({ breakRemaining, currentBlockIndex, blockSold, onSkip }: DefconBreakProps) {
  const minutes = Math.floor(breakRemaining / 60);
  const seconds = breakRemaining % 60;

  return (
    <div className="min-h-[100dvh] bg-background pt-safe pb-safe flex flex-col items-center justify-center px-6 select-none">
      <div className="text-center space-y-8">
        <div className="text-6xl">☕</div>

        <div>
          <div className="text-xs font-mono text-muted-foreground tracking-[0.3em] uppercase mb-3">
            PAUSA
          </div>
          <div className="text-7xl md:text-8xl font-black font-mono tabular-nums tracking-tighter text-foreground">
            {String(minutes).padStart(2, "0")}
            <span className="text-foreground/30">:</span>
            {String(seconds).padStart(2, "0")}
          </div>
        </div>

        <p className="text-lg text-muted-foreground font-medium">
          Beba água. Respire.
        </p>

        <div className="text-sm font-mono text-muted-foreground">
          Bloco #{currentBlockIndex + 1} concluído
          {blockSold > 0 && ` • ${formatCurrency(blockSold)} vendido`}
        </div>

        {onSkip && (
          <button
            onClick={onSkip}
            className="mx-auto flex items-center gap-2 px-6 py-3 rounded-full bg-warning text-warning-foreground font-black text-sm tracking-wide shadow-lg shadow-warning/20 active:scale-95 transition-[colors,transform,opacity] hover:bg-warning/90"
          >
            <FastForward className="w-4 h-4" strokeWidth={3} />
            INICIAR PRÓXIMO BLOCO
          </button>
        )}

        <div className="text-xs font-mono text-muted-foreground">
          Próximo bloco inicia automaticamente
        </div>
      </div>
    </div>
  );
}

