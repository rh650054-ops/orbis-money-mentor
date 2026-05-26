import { useState } from "react";
import { Wallet, FastForward } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import QuickExpenseButton from "@/components/QuickExpenseButton";

interface DefconLunchPauseProps {
  lunchPauseRemaining: number;
  totalSold: number;
  onSkip?: () => void;
}

export function DefconLunchPause({ lunchPauseRemaining, totalSold, onSkip }: DefconLunchPauseProps) {
  const minutes = Math.floor(lunchPauseRemaining / 60);
  const seconds = lunchPauseRemaining % 60;
  const [expenseOpen, setExpenseOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-black pt-safe pb-safe flex flex-col items-center justify-center px-6 select-none">
      <div className="text-center space-y-8">
        <div className="text-6xl">🍽️</div>

        <div>
          <div className="text-xs font-mono text-warning/70 tracking-[0.3em] uppercase mb-3">
            PAUSA ALMOÇO
          </div>
          <div className="text-7xl md:text-8xl font-black font-mono tabular-nums tracking-tighter text-white">
            {String(minutes).padStart(2, "0")}
            <span className="text-white/30">:</span>
            {String(seconds).padStart(2, "0")}
          </div>
        </div>

        <p className="text-lg text-warning/60 font-medium">
          Bom apetite. Recarregue as energias.
        </p>

        <div className="text-sm font-mono text-neutral-600">
          Vendido até agora: {formatCurrency(totalSold)}
        </div>

        {/* Ações */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setExpenseOpen(true)}
            className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-warning text-warning-foreground font-black text-sm tracking-wide shadow-lg shadow-warning/20 active:scale-95 transition-[colors,transform,opacity] hover:bg-warning/90"
          >
            <Wallet className="w-4 h-4" strokeWidth={3} />
            REGISTRAR CUSTO DO ALMOÇO
          </button>

          {onSkip && (
            <button
              onClick={onSkip}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/20 bg-white/5 text-white/80 font-bold text-xs tracking-wide active:scale-95 transition-[colors,transform,opacity] hover:bg-white/10 hover:text-white"
            >
              <FastForward className="w-3.5 h-3.5" strokeWidth={3} />
              VOLTAR AO DESAFIO AGORA
            </button>
          )}
        </div>

        <div className="text-xs font-mono text-neutral-700">
          O desafio volta automaticamente
        </div>
      </div>

      <QuickExpenseButton
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        hideFab
        initialCategoryKey="almoco"
      />
    </div>
  );
}
