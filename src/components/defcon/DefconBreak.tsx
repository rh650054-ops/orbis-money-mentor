import { FastForward } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
    <div className="min-h-[100dvh] bg-black pt-safe pb-safe flex flex-col items-center justify-center px-6 select-none">
      <div className="text-center space-y-8">
        <div className="text-6xl">☕</div>

        <div>
          <div className="text-xs font-mono text-neutral-600 tracking-[0.3em] uppercase mb-3">
            PAUSA
          </div>
          <div className="text-7xl md:text-8xl font-black font-mono tabular-nums tracking-tighter text-white">
            {String(minutes).padStart(2, "0")}
            <span className="text-white/30">:</span>
            {String(seconds).padStart(2, "0")}
          </div>
        </div>

        <p className="text-lg text-neutral-500 font-medium">
          Beba água. Respire.
        </p>

        <div className="text-sm font-mono text-neutral-600">
          Bloco #{currentBlockIndex + 1} concluído
          {blockSold > 0 && ` • ${formatCurrency(blockSold)} vendido`}
        </div>

        {onSkip && (
          <button
            onClick={onSkip}
            className="mx-auto flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 text-black font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-95 transition-all hover:bg-amber-400"
          >
            <FastForward className="w-4 h-4" strokeWidth={3} />
            INICIAR PRÓXIMO BLOCO
          </button>
        )}

        <div className="text-xs font-mono text-neutral-700">
          Próximo bloco inicia automaticamente
        </div>
      </div>
    </div>
  );
}

