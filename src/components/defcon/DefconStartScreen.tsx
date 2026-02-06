import { formatCurrency } from "@/lib/utils";

interface DefconStartScreenProps {
  dailyGoal: number;
  totalBlocks: number;
  onStart: () => void;
  onExit: () => void;
}

export function DefconStartScreen({ dailyGoal, totalBlocks, onStart, onExit }: DefconStartScreenProps) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
      {/* Title */}
      <div className="text-center mb-12">
        <div className="text-xs font-mono text-red-500 tracking-[0.5em] uppercase mb-4">
          DEFCON 4
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-3">
          MODO DESAFIO
        </h1>
        <p className="text-sm text-neutral-600 font-mono max-w-xs mx-auto">
          Blocos de 60 minutos. Sem distrações. Apenas vendas.
        </p>
      </div>

      {/* Plan info */}
      <div className="w-full max-w-sm space-y-4 mb-10">
        <div className="bg-neutral-900 rounded-xl p-6 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-neutral-500">Meta do dia</span>
            <span className="text-xl font-black text-white">{formatCurrency(dailyGoal)}</span>
          </div>
          <div className="h-px bg-neutral-800" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-neutral-500">Blocos</span>
            <span className="text-lg font-bold text-white">{totalBlocks} × 60min</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-mono text-neutral-500">Pausa entre blocos</span>
            <span className="text-lg font-bold text-neutral-400">5 min</span>
          </div>
        </div>
      </div>

      {/* Start button */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={onStart}
          className="w-full h-16 bg-red-600 text-white font-black text-xl rounded-xl active:scale-95 transition-transform"
        >
          INICIAR DEFCON 4
        </button>
        <button
          onClick={onExit}
          className="w-full h-12 bg-transparent text-neutral-600 font-mono text-sm active:scale-95 transition-transform"
        >
          Sair do modo desafio
        </button>
      </div>

      {/* Rules */}
      <div className="mt-12 max-w-xs text-center">
        <ul className="text-xs text-neutral-700 font-mono space-y-1">
          <li>• Blocos de 60 minutos cada</li>
          <li>• Pausa de 5 minutos entre blocos</li>
          <li>• Registre vendas com o botão +</li>
          <li>• Encerrar = perder streak</li>
        </ul>
      </div>
    </div>
  );
}
