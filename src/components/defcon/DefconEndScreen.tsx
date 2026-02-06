import { formatCurrency } from "@/lib/utils";

interface DefconEndScreenProps {
  phase: "finished" | "abandoned";
  totalSold: number;
  dailyGoal: number;
  totalBlocks: number;
  onExit: () => void;
}

export function DefconEndScreen({
  phase,
  totalSold,
  dailyGoal,
  totalBlocks,
  onExit,
}: DefconEndScreenProps) {
  const percentage = dailyGoal > 0 ? (totalSold / dailyGoal) * 100 : 0;
  const goalReached = totalSold >= dailyGoal;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
      {/* Status */}
      <div className="text-center mb-10">
        <div className="text-xs font-mono text-neutral-600 tracking-[0.3em] uppercase mb-4">
          {phase === "abandoned" ? "Desafio encerrado" : "Desafio concluído"}
        </div>

        {phase === "abandoned" ? (
          <div className="text-6xl mb-4">⛔</div>
        ) : goalReached ? (
          <div className="text-6xl mb-4">🏆</div>
        ) : (
          <div className="text-6xl mb-4">📊</div>
        )}
      </div>

      {/* Stats */}
      <div className="w-full max-w-sm space-y-6 mb-10">
        <div className="bg-neutral-900 rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-neutral-500">Total vendido</span>
            <span className="text-2xl font-black text-white">
              {formatCurrency(totalSold)}
            </span>
          </div>

          <div className="h-px bg-neutral-800" />

          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-neutral-500">Meta</span>
            <span className="text-lg font-bold text-neutral-400">
              {formatCurrency(dailyGoal)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-neutral-500">Progresso</span>
            <span className={`text-lg font-bold ${
              goalReached ? "text-green-500" : "text-red-500"
            }`}>
              {percentage.toFixed(0)}%
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-neutral-500">Blocos completados</span>
            <span className="text-lg font-bold text-white">{totalBlocks}</span>
          </div>
        </div>

        {/* Cold message */}
        <p className="text-center text-sm text-neutral-600 font-mono">
          {phase === "abandoned"
            ? "Você encerrou antes do tempo. Streak perdida."
            : goalReached
            ? "Missão cumprida. Sem mais o que dizer."
            : "Números não mentem. Amanhã tem mais."
          }
        </p>
      </div>

      {/* Exit */}
      <button
        onClick={onExit}
        className="w-full max-w-sm h-14 bg-neutral-900 border border-neutral-800 text-white font-bold text-lg rounded-xl active:scale-95 transition-transform"
      >
        SAIR
      </button>
    </div>
  );
}
