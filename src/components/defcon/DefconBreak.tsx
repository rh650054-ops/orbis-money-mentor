import { formatCurrency } from "@/lib/utils";

interface DefconBreakProps {
  breakRemaining: number;
  currentBlockIndex: number;
  blockSold: number;
}

export function DefconBreak({ breakRemaining, currentBlockIndex, blockSold }: DefconBreakProps) {
  const minutes = Math.floor(breakRemaining / 60);
  const seconds = breakRemaining % 60;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
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

        <div className="text-xs font-mono text-neutral-700">
          Próximo bloco inicia automaticamente
        </div>
      </div>
    </div>
  );
}
