import { formatCurrency } from "@/lib/utils";

interface DefconLunchPauseProps {
  lunchPauseRemaining: number;
  totalSold: number;
}

export function DefconLunchPause({ lunchPauseRemaining, totalSold }: DefconLunchPauseProps) {
  const minutes = Math.floor(lunchPauseRemaining / 60);
  const seconds = lunchPauseRemaining % 60;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
      <div className="text-center space-y-8">
        <div className="text-6xl">🍽️</div>

        <div>
          <div className="text-xs font-mono text-amber-500/60 tracking-[0.3em] uppercase mb-3">
            PAUSA ALMOÇO
          </div>
          <div className="text-7xl md:text-8xl font-black font-mono tabular-nums tracking-tighter text-white">
            {String(minutes).padStart(2, "0")}
            <span className="text-white/30">:</span>
            {String(seconds).padStart(2, "0")}
          </div>
        </div>

        <p className="text-lg text-amber-500/50 font-medium">
          Bom apetite. Recarregue as energias.
        </p>

        <div className="text-sm font-mono text-neutral-600">
          Vendido até agora: {formatCurrency(totalSold)}
        </div>

        <div className="text-xs font-mono text-neutral-700">
          O desafio volta automaticamente
        </div>
      </div>
    </div>
  );
}
